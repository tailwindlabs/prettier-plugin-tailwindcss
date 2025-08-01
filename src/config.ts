// @ts-check
import * as path from 'path'
import { pathToFileURL } from 'url'
import escalade from 'escalade/sync'
import prettier from 'prettier'
import type { ParserOptions } from 'prettier'
import { expiringMap } from './expiring-map.js'
import { resolveJsFrom } from './resolve'
import type { UnifiedApi } from './types'
import { loadV3 } from './versions/v3'
import { loadV4 } from './versions/v4'

let pathToApiMap = expiringMap<string | null, Promise<UnifiedApi>>(10_000)

export async function getTailwindConfig(options: ParserOptions): Promise<any> {
  let cwd = process.cwd()

  // Locate the file being processed
  //
  // We'll resolve auto-detected paths relative to this path.
  //
  // Examples:
  // - Tailwind CSS itself
  // - Automatically found v3 configs
  let inputDir = options.filepath ? path.dirname(options.filepath) : cwd

  // Locate the prettier config
  //
  // We'll resolve paths defined in the config relative to this path.
  //
  // Examples:
  // - A project's stylesheet
  //
  // These lookups can take a bit so we cache them. This is especially important
  // for files with lots of embedded languages (e.g. Vue bindings).
  let configDir = await resolvePrettierConfigPath(options.filepath)

  // Locate Tailwind CSS itself
  //
  // We resolve this like we're in `inputDir` for better monorepo support as
  // Prettier may be configured at the workspace root but Tailwind CSS is
  // installed for a workspace package rather than the entire monorepo
  let [mod, pkgDir] = await resolveTailwindPath(options, configDir)

  // Locate the v4 stylesheet relative to the prettier config file
  //
  // We resolve this relative to the config file because it is *required*
  // to work with a project's custom config. Given that, resolving it
  // relative to where the path is defined makes the most sense.
  let stylesheet = resolveStylesheet(options, configDir)

  // Locate the closest v3 config file
  //
  // Note:
  // We only need to do this when a stylesheet has not been provided otherwise
  // we'd know for sure this was a v4 project regardless of what local Tailwind
  // CSS installation is present. Additionally, if the local version is v4 we
  // can skip this as well.
  //
  // The config path is resolved in one of two ways:
  //
  // 1. When automatic, relative to the input file
  //
  // This ensures monorepos can load the "closest" JS config for a given file
  // which is important when a workspace package includes Tailwind CSS *and*
  // Prettier is configured globally instead of per-package.
  //
  //
  // 2. When explicit via `tailwindConfig`, relative to the prettier config
  //
  // For the same reasons as the v4 stylesheet, it's important that the config
  // file be resolved relative to the file it's configured in.
  if (!stylesheet && !mod?.__unstable__loadDesignSystem) {
    let jsConfig = resolveJsConfigPath(options, configDir)
    if (jsConfig) {
      return pathToApiMap.remember(`${pkgDir}:${jsConfig}`, () => loadV3(pkgDir, jsConfig))
    }
  }

  // The user specified a stylesheet but their local install is not v4
  // so we'll load the fallback version instead
  if (mod && !mod.__unstable__loadDesignSystem) {
    mod = null
    if (stylesheet) {
      console.error(
        'You have specified a Tailwind CSS stylesheet but your version of Tailwind CSS does not support this feature.',
      )
    }
  } else if (mod && pkgDir) {
    // If the user hasn't provided a stylesheet then we'll load the default
    // theme from Tailwind CSS itself.
    stylesheet ??= `${pkgDir}/theme.css`
  }

  if (stylesheet) {
    return pathToApiMap.remember(`${pkgDir}:${stylesheet}`, () => loadV4(mod, stylesheet))
  }

  // Current fallback is v3
  return pathToApiMap.remember(null, () => loadV3(null, null))

  // Move to default fallback of v4
  return pathToApiMap.remember(null, () => loadV4(null, null))
}

let prettierConfigCache = expiringMap<string, Promise<string | null>>(10_000)

async function resolvePrettierConfigPath(filePath: string): Promise<string> {
  let prettierConfig = await prettierConfigCache.remember(filePath, async () => {
    try {
      return await prettier.resolveConfigFile(filePath)
    } catch (err) {
      console.error('Failed to resolve Prettier Config')
      console.error(err)
      return null
    }
  })

  return prettierConfig ? path.dirname(prettierConfig) : process.cwd()
}

let resolvedModCache = expiringMap<string, Promise<[any | null, string | null]>>(10_000)

async function resolveTailwindPath(options: ParserOptions, baseDir: string): Promise<[any | null, string | null]> {
  let pkgName = options.tailwindPackageName ?? 'tailwindcss'

  return await resolvedModCache.remember(`${pkgName}:${baseDir}`, async () => {
    let pkgDir: string | null = null
    let mod: any | null = null

    try {
      let pkgPath = resolveJsFrom(baseDir, pkgName)
      mod = await import(pathToFileURL(pkgPath).toString())

      let pkgFile = resolveJsFrom(baseDir, `${pkgName}/package.json`)
      pkgDir = path.dirname(pkgFile)
    } catch {}

    return [mod, pkgDir] as const
  })
}

let configPathCache = new Map<string, string | null>()
function resolveJsConfigPath(options: ParserOptions, configDir: string): string | null {
  if (options.tailwindConfig) {
    if (options.tailwindConfig.endsWith('.css')) return null

    return path.resolve(configDir, options.tailwindConfig)
  }

  let configPath: string | null | undefined = configPathCache.get(configDir)

  if (configPath === undefined) {
    try {
      let foundPath = escalade(configDir, (_, names) => {
        if (names.includes('tailwind.config.js')) return 'tailwind.config.js'
        if (names.includes('tailwind.config.cjs')) return 'tailwind.config.cjs'
        if (names.includes('tailwind.config.mjs')) return 'tailwind.config.mjs'
        if (names.includes('tailwind.config.ts')) return 'tailwind.config.ts'
      })

      configPath = foundPath ?? null
    } catch {}

    configPath ??= null
    configPathCache.set(configDir, configPath)
  }

  return configPath
}

function resolveStylesheet(options: ParserOptions, baseDir: string): string | null {
  if (options.tailwindStylesheet) {
    if (
      options.tailwindStylesheet.endsWith('.js') ||
      options.tailwindStylesheet.endsWith('.mjs') ||
      options.tailwindStylesheet.endsWith('.cjs') ||
      options.tailwindStylesheet.endsWith('.ts') ||
      options.tailwindStylesheet.endsWith('.mts') ||
      options.tailwindStylesheet.endsWith('.cts')
    ) {
      console.error(
        "Your `tailwindStylesheet` option points to a JS/TS config file. You must point to your project's `.css` file for v4 projects.",
      )
    } else if (
      options.tailwindStylesheet.endsWith('.sass') ||
      options.tailwindStylesheet.endsWith('.scss') ||
      options.tailwindStylesheet.endsWith('.less') ||
      options.tailwindStylesheet.endsWith('.styl')
    ) {
      console.error(
        'Your `tailwindStylesheet` option points to a preprocessor file. This is unsupported and you may get unexpected results.',
      )
    } else if (!options.tailwindStylesheet.endsWith('.css')) {
      console.error(
        'Your `tailwindStylesheet` option does not point to a CSS file. This is unsupported and you may get unexpected results.',
      )
    }

    return path.resolve(baseDir, options.tailwindStylesheet)
  }

  if (options.tailwindEntryPoint) {
    console.warn('Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindEntryPoint`.')

    return path.resolve(baseDir, options.tailwindEntryPoint)
  }

  if (options.tailwindConfig && options.tailwindConfig.endsWith('.css')) {
    console.warn('Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindConfig`.')

    return path.resolve(baseDir, options.tailwindConfig)
  }

  return null
}
