// @ts-check
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import escalade from 'escalade/sync'
import prettier from 'prettier'
import type { ParserOptions } from 'prettier'
import * as console from './console'
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
  let [configDir, configPath] = await resolvePrettierConfigPath(options.filepath)

  // Locate Tailwind CSS itself
  //
  // We resolve this like we're in `inputDir` for better monorepo support as
  // Prettier may be configured at the workspace root but Tailwind CSS is
  // installed for a workspace package rather than the entire monorepo
  let [mod, pkgDir] = await resolveTailwindPath(options, inputDir)

  // Locate project stylesheet relative to the prettier config file
  //
  // We resolve this relative to the config file because it is *required*
  // to work with a project's custom config. Given that, resolving it
  // relative to where the path is defined makes the most sense.
  let stylesheet = resolveStylesheet(options, configDir, configPath)

  // Locate *explicit* v3 configs relative to the prettier config file
  //
  // We use this as a signal that we should always use v3 to format files even
  // when the local install is v4 — which means we'll use the bundled v3.
  let jsConfig = resolveJsConfigPath(options, configDir)

  // Locate the closest v3 config file
  //
  // Note:
  // We only need to do this when a stylesheet has not been provided otherwise
  // we'd know for sure this was a v4 project regardless of what local Tailwind
  // CSS installation is present. Additionally, if the local version is v4 we
  // skip this as we assume that the user intends to use that version.
  //
  // The config path is resolved in one of two ways:
  //
  // 1. When automatic, relative to the input file
  //
  // This ensures monorepos can load the "closest" JS config for a given file
  // which is important when a workspace package includes Tailwind CSS *and*
  // Prettier is configured globally instead of per-package.
  //
  // 2. When explicit via `tailwindConfig`, relative to the prettier config
  //
  // For the same reasons as the v4 stylesheet, it's important that the config
  // file be resolved relative to the file it's configured in.
  if (!stylesheet && !mod?.__unstable__loadDesignSystem) {
    jsConfig = jsConfig ?? findClosestJsConfig(inputDir)
  }

  // We've found a JS config either because it was specified by the user
  // or because it was automatically located. This means we should use v3.
  if (jsConfig) {
    if (!stylesheet) {
      return pathToApiMap.remember(`${pkgDir}:${jsConfig}`, () => loadV3(pkgDir, jsConfig))
    }

    // In this case the user explicitly gave us a stylesheet and a config.
    // Warn them about this and use the bundled v4.
    console.error(
      'explicit-stylesheet-and-config-together',
      configPath ?? '',
      `You have specified a Tailwind CSS stylesheet and a Tailwind CSS config at the same time. Use tailwindStylesheet unless you are using v3. Preferring the stylesheet.`,
    )
  }

  if (mod && !mod.__unstable__loadDesignSystem) {
    if (!stylesheet) {
      return pathToApiMap.remember(`${pkgDir}:${jsConfig}`, () => loadV3(pkgDir, jsConfig))
    }

    // In this case the user explicitly gave us a stylesheet but their local
    // installation is not v4. We'll fallback to the bundled v4 in this case.
    mod = null
    console.error(
      'stylesheet-unsupported',
      configPath ?? '',
      'You have specified a Tailwind CSS stylesheet but your installed version of Tailwind CSS does not support this feature.',
    )
  }

  // If we've detected a local version of v4 then we should fallback to using
  // its included theme as the stylesheet if the user didn't give us one.
  if (mod && mod.__unstable__loadDesignSystem && pkgDir) {
    stylesheet ??= `${pkgDir}/theme.css`
  }

  // No stylesheet was given or otherwise found in a local v4 installation
  // nor was a tailwind config given or found.
  //
  // Fallback to v3
  if (!stylesheet) {
    return pathToApiMap.remember(null, () => loadV3(null, null))
  }

  return pathToApiMap.remember(`${pkgDir}:${stylesheet}`, () => loadV4(mod, stylesheet))
}

let prettierConfigCache = expiringMap<string, Promise<string | null>>(10_000)

async function resolvePrettierConfigPath(filePath: string): Promise<[string, string | null]> {
  let prettierConfig = await prettierConfigCache.remember(filePath, async () => {
    try {
      return await prettier.resolveConfigFile(filePath)
    } catch (err) {
      console.error('prettier-config-not-found', 'Failed to resolve Prettier Config')
      console.error('prettier-config-not-found-err', err)
      return null
    }
  })

  return prettierConfig ? [path.dirname(prettierConfig), prettierConfig] : [process.cwd(), null]
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

function resolveJsConfigPath(options: ParserOptions, configDir: string): string | null {
  if (!options.tailwindConfig) return null
  if (options.tailwindConfig.endsWith('.css')) return null

  return path.resolve(configDir, options.tailwindConfig)
}

let configPathCache = new Map<string, string | null>()
function findClosestJsConfig(inputDir: string): string | null {
  let configPath: string | null | undefined = configPathCache.get(inputDir)

  if (configPath === undefined) {
    try {
      let foundPath = escalade(inputDir, (_, names) => {
        if (names.includes('tailwind.config.js')) return 'tailwind.config.js'
        if (names.includes('tailwind.config.cjs')) return 'tailwind.config.cjs'
        if (names.includes('tailwind.config.mjs')) return 'tailwind.config.mjs'
        if (names.includes('tailwind.config.ts')) return 'tailwind.config.ts'
      })

      configPath = foundPath ?? null
    } catch {}

    configPath ??= null
    configPathCache.set(inputDir, configPath)
  }

  return configPath
}

function resolveStylesheet(options: ParserOptions, baseDir: string, configPath: string | null): string | null {
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
        'stylesheet-is-js-file',
        configPath ?? '',
        "Your `tailwindStylesheet` option points to a JS/TS config file. You must point to your project's `.css` file for v4 projects.",
      )
    } else if (
      options.tailwindStylesheet.endsWith('.sass') ||
      options.tailwindStylesheet.endsWith('.scss') ||
      options.tailwindStylesheet.endsWith('.less') ||
      options.tailwindStylesheet.endsWith('.styl')
    ) {
      console.error(
        'stylesheet-is-preprocessor-file',
        configPath ?? '',
        'Your `tailwindStylesheet` option points to a preprocessor file. This is unsupported and you may get unexpected results.',
      )
    } else if (!options.tailwindStylesheet.endsWith('.css')) {
      console.error(
        'stylesheet-is-not-css-file',
        configPath ?? '',
        'Your `tailwindStylesheet` option does not point to a CSS file. This is unsupported and you may get unexpected results.',
      )
    }

    return path.resolve(baseDir, options.tailwindStylesheet)
  }

  if (options.tailwindEntryPoint) {
    console.warn(
      'entrypoint-is-deprecated',
      configPath ?? '',
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindEntryPoint`.',
    )

    return path.resolve(baseDir, options.tailwindEntryPoint)
  }

  if (options.tailwindConfig && options.tailwindConfig.endsWith('.css')) {
    console.warn(
      'config-as-css-is-deprecated',
      configPath ?? '',
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindConfig`.',
    )

    return path.resolve(baseDir, options.tailwindConfig)
  }

  return null
}
