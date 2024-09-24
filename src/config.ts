// @ts-check
import * as fs from 'fs/promises'
import * as path from 'path'
import { pathToFileURL } from 'url'
import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import postcss from 'postcss'
// @ts-ignore
import postcssImport from 'postcss-import'
import prettier from 'prettier'
import type { ParserOptions } from 'prettier'
// @ts-ignore
import { generateRules as generateRulesFallback } from 'tailwindcss/lib/lib/generateRules'
// @ts-ignore
import { createContext as createContextFallback } from 'tailwindcss/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss/loadConfig'
import resolveConfigFallback from 'tailwindcss/resolveConfig'
import type { RequiredConfig } from 'tailwindcss/types/config.js'
import { expiringMap } from './expiring-map.js'
import { resolveCssFrom, resolveJsFrom } from './resolve'
import type { ContextContainer } from './types'

let sourceToPathMap = new Map<string, string | null>()
let sourceToEntryMap = new Map<string, string | null>()
let pathToContextMap = expiringMap<string | null, ContextContainer>(10_000)
let prettierConfigCache = expiringMap<string, string | null>(10_000)

export async function getTailwindConfig(
  options: ParserOptions,
): Promise<ContextContainer> {
  let key = `${options.filepath}:${options.tailwindConfig ?? ''}:${options.tailwindEntryPoint ?? ''}`
  let baseDir = await getBaseDir(options)

  // Map the source file to it's associated Tailwind config file
  let configPath = sourceToPathMap.get(key)
  if (configPath === undefined) {
    configPath = getConfigPath(options, baseDir)
    sourceToPathMap.set(key, configPath)
  }

  let entryPoint = sourceToEntryMap.get(key)
  if (entryPoint === undefined) {
    entryPoint = getEntryPoint(options, baseDir)
    sourceToEntryMap.set(key, entryPoint)
  }

  // Now see if we've loaded the Tailwind config file before (and it's still valid)
  let contextKey = `${configPath}:${entryPoint}`
  let existing = pathToContextMap.get(contextKey)
  if (existing) {
    return existing
  }

  // By this point we know we need to load the Tailwind config file
  let result = await loadTailwindConfig(baseDir, configPath, entryPoint)

  pathToContextMap.set(contextKey, result)

  return result
}

async function getPrettierConfigPath(
  options: ParserOptions,
): Promise<string | null> {
  // Locating the config file can be mildly expensive so we cache it temporarily
  let existingPath = prettierConfigCache.get(options.filepath)
  if (existingPath !== undefined) {
    return existingPath
  }

  let path = await prettier.resolveConfigFile(options.filepath)
  prettierConfigCache.set(options.filepath, path)

  return path
}

async function getBaseDir(options: ParserOptions): Promise<string> {
  let prettierConfigPath = await getPrettierConfigPath(options)

  if (options.tailwindConfig) {
    return prettierConfigPath ? path.dirname(prettierConfigPath) : process.cwd()
  }

  if (options.tailwindEntryPoint) {
    return prettierConfigPath ? path.dirname(prettierConfigPath) : process.cwd()
  }

  return prettierConfigPath
    ? path.dirname(prettierConfigPath)
    : options.filepath
      ? path.dirname(options.filepath)
      : process.cwd()
}

async function loadTailwindConfig(
  baseDir: string,
  tailwindConfigPath: string | null,
  entryPoint: string | null,
): Promise<ContextContainer> {
  let createContext = createContextFallback
  let generateRules = generateRulesFallback
  let resolveConfig = resolveConfigFallback
  let loadConfig = loadConfigFallback
  let tailwindConfig: RequiredConfig = { content: [] }

  try {
    let pkgFile = resolveJsFrom(baseDir, 'tailwindcss/package.json')
    let pkgDir = path.dirname(pkgFile)

    try {
      let v4 = await loadV4(baseDir, pkgDir, entryPoint)
      if (v4) {
        return v4
      }
    } catch {}

    resolveConfig = require(path.join(pkgDir, 'resolveConfig'))
    createContext = require(
      path.join(pkgDir, 'lib/lib/setupContextUtils'),
    ).createContext
    generateRules = require(
      path.join(pkgDir, 'lib/lib/generateRules'),
    ).generateRules

    // Prior to `tailwindcss@3.3.0` this won't exist so we load it last
    loadConfig = require(path.join(pkgDir, 'loadConfig'))
  } catch {}

  if (tailwindConfigPath) {
    clearModule(tailwindConfigPath)
    const loadedConfig = loadConfig(tailwindConfigPath)
    tailwindConfig = loadedConfig.default ?? loadedConfig
  }

  // suppress "empty content" warning
  tailwindConfig.content = ['no-op']

  // Create the context
  let context = createContext(resolveConfig(tailwindConfig))

  return {
    context,
    generateRules,
  }
}

/**
 * Create a loader function that can load plugins and config files relative to
 * the CSS file that uses them. However, we don't want missing files to prevent
 * everything from working so we'll let the error handler decide how to proceed.
 */
function createLoader<T>({
  legacy,
  filepath,
  onError,
}: {
  legacy: boolean
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = resolveJsFrom(base, id)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await import(url.href).then((m) => m.default ?? m)
    } catch (err) {
      return onError(id, err, resourceType)
    }
  }

  if (legacy) {
    let baseDir = path.dirname(filepath)
    return (id: string) => loadFile(id, baseDir, 'module')
  }

  return async (id: string, base: string, resourceType: string) => {
    return {
      base,
      module: await loadFile(id, base, resourceType),
    }
  }
}

async function loadV4(
  baseDir: string,
  pkgDir: string,
  entryPoint: string | null,
) {
  // Import Tailwind — if this is v4 it'll have APIs we can use directly
  let pkgPath = resolveJsFrom(baseDir, 'tailwindcss')

  let tw = await import(pathToFileURL(pkgPath).toString())

  // This is not Tailwind v4
  if (!tw.__unstable__loadDesignSystem) {
    return null
  }

  // If the user doesn't define an entrypoint then we use the default theme
  entryPoint = entryPoint ?? `${pkgDir}/theme.css`

  let importBasePath = path.dirname(entryPoint)

  // Resolve imports in the entrypoint to a flat CSS tree
  let css = await fs.readFile(entryPoint, 'utf-8')

  // Determine if the v4 API supports resolving `@import`
  let supportsImports = false
  try {
    await tw.__unstable__loadDesignSystem('@import "./empty";', {
      loadStylesheet: () => {
        supportsImports = true
        return {
          base: importBasePath,
          content: '',
        }
      },
    })
  } catch {}

  if (!supportsImports) {
    let resolveImports = postcss([postcssImport()])
    let result = await resolveImports.process(css, { from: entryPoint })
    css = result.css
  }

  // Load the design system and set up a compatible context object that is
  // usable by the rest of the plugin
  let design = await tw.__unstable__loadDesignSystem(css, {
    base: importBasePath,

    // v4.0.0-alpha.25+
    loadModule: createLoader({
      legacy: false,
      filepath: entryPoint,
      onError: (id, err, resourceType) => {
        console.error(`Unable to load ${resourceType}: ${id}`, err)

        if (resourceType === 'config') {
          return {}
        } else if (resourceType === 'plugin') {
          return () => {}
        }
      },
    }),

    loadStylesheet: async (id: string, base: string) => {
      let resolved = resolveCssFrom(base, id)

      return {
        base: path.dirname(resolved),
        content: await fs.readFile(resolved, 'utf-8'),
      }
    },

    // v4.0.0-alpha.24 and below
    loadPlugin: createLoader({
      legacy: true,
      filepath: entryPoint,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      legacy: true,
      filepath: entryPoint,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  return {
    context: {
      getClassOrder: (classList: string[]) => design.getClassOrder(classList),
    },

    // Stubs that are not needed for v4
    generateRules: () => [],
  }
}

function getConfigPath(options: ParserOptions, baseDir: string): string | null {
  if (options.tailwindConfig) {
    return path.resolve(baseDir, options.tailwindConfig)
  }

  let configPath: string | void = undefined
  try {
    configPath = escalade(baseDir, (_dir, names) => {
      if (names.includes('tailwind.config.js')) {
        return 'tailwind.config.js'
      }
      if (names.includes('tailwind.config.cjs')) {
        return 'tailwind.config.cjs'
      }
      if (names.includes('tailwind.config.mjs')) {
        return 'tailwind.config.mjs'
      }
      if (names.includes('tailwind.config.ts')) {
        return 'tailwind.config.ts'
      }
    })
  } catch {}

  if (configPath) {
    return configPath
  }

  return null
}

function getEntryPoint(options: ParserOptions, baseDir: string): string | null {
  if (options.tailwindEntryPoint) {
    return path.resolve(baseDir, options.tailwindEntryPoint)
  }

  return null
}
