// @ts-check
import * as fs from 'fs/promises'
import { createRequire } from 'module'
import * as path from 'path'
import { pathToFileURL } from 'url'
import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import prettier from 'prettier'
// @ts-ignore
import { generateRules as generateRulesFallback } from 'tailwindcss/lib/lib/generateRules'
// @ts-ignore
import { createContext as createContextFallback } from 'tailwindcss/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss/loadConfig'
import resolveConfigFallback from 'tailwindcss/resolveConfig'
import { expiringMap } from './expiring-map.js'

let localRequire = createRequire(import.meta.url)

/** @typedef {import('prettier').ParserOptions} ParserOptions **/
/** @typedef {import('./types.js').ContextContainer} ContextContainer **/

/**
 * @template K
 * @template V
 * @typedef {import('./expiring-map.js').ExpiringMap<K,V>} ExpiringMap
 **/

/** @type {Map<string, string | null>} */
let sourceToPathMap = new Map()

/** @type {Map<string, string | null>} */
let sourceToEntryMap = new Map()

/** @type {ExpiringMap<string | null, ContextContainer>} */
let pathToContextMap = expiringMap(10_000)

/** @type {ExpiringMap<string, string | null>} */
let prettierConfigCache = expiringMap(10_000)

/**
 * @param {ParserOptions} options
 * @returns {Promise<ContextContainer>}
 */
export async function getTailwindConfig(options) {
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

/**
 *
 * @param {ParserOptions} options
 * @returns {Promise<string | null>}
 */
async function getPrettierConfigPath(options) {
  // Locating the config file can be mildly expensive so we cache it temporarily
  let existingPath = prettierConfigCache.get(options.filepath)
  if (existingPath !== undefined) {
    return existingPath
  }

  let path = await prettier.resolveConfigFile(options.filepath)
  prettierConfigCache.set(options.filepath, path)

  return path
}

/**
 * @param {ParserOptions} options
 * @returns {Promise<string>}
 */
async function getBaseDir(options) {
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

/**
 * @param {string} baseDir
 * @param {string | null} tailwindConfigPath
 * @param {string | null} entryPoint
 * @returns {Promise<ContextContainer>}
 */
async function loadTailwindConfig(baseDir, tailwindConfigPath, entryPoint) {
  let createContext = createContextFallback
  let generateRules = generateRulesFallback
  let resolveConfig = resolveConfigFallback
  let loadConfig = loadConfigFallback
  let tailwindConfig = {}

  try {
    let pkgFile = localRequire.resolve('tailwindcss/package.json', {
      paths: [baseDir],
    })

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
 * @param {string} baseDir
 * @param {string} pkgDir
 * @param {string | null} entryPoint
 */
async function loadV4(baseDir, pkgDir, entryPoint) {
  // Import Tailwind — if this is v4 it'll have APIs we can use directly
  let pkgPath = localRequire.resolve('tailwindcss', {
    paths: [baseDir],
  })
  let tw = await import(pathToFileURL(pkgPath).toString())

  // This is not Tailwind v4
  if (!tw.__unstable__loadDesignSystem) {
    return null
  }

  // If the user doesn't define an entrypoint then we use the default theme
  entryPoint = entryPoint ?? `${pkgDir}/theme.css`

  // Resolve imports in the entrypoint to a flat CSS tree
  let css = await fs.readFile(entryPoint, 'utf-8')
  let resolveImports = postcss([postcssImport()])
  let result = await resolveImports.process(css, { from: entryPoint })

  // Load the design system and set up a compatible context object that is
  // usable by the rest of the plugin
  let design = tw.__unstable__loadDesignSystem(result.css)

  return {
    context: {
      /**
       * @param {string[]} classList
       */
      getClassOrder: (classList) => design.getClassOrder(classList),
    },

    // Stubs that are not needed for v4
    generateRules: () => [],
  }
}

/**
 * @param {ParserOptions} options
 * @param {string} baseDir
 * @returns {string | null}
 */
function getConfigPath(options, baseDir) {
  if (options.tailwindConfig) {
    return path.resolve(baseDir, options.tailwindConfig)
  }

  let configPath
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

/**
 * @param {ParserOptions} options
 * @param {string} baseDir
 * @returns {string | null}
 */
function getEntryPoint(options, baseDir) {
  if (options.tailwindEntryPoint) {
    return path.resolve(baseDir, options.tailwindEntryPoint)
  }

  return null
}
