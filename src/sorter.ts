import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import escalade from 'escalade/sync'
import * as console from './console'
import { expiringMap } from './expiring-map.js'
import { resolveJsFrom } from './resolve'
import { sortClasses, sortClassList } from './sorting.js'
import type { TransformerEnv, UnifiedApi } from './types'
import { cacheForDirs } from './utils.js'

export interface SorterOptions {
  /**
   * The directory used to resolve relative file paths.
   *
   * When not provided this will be:
   * - The current working directory
   */
  base?: string

  /**
   * The path to the file being formatted.
   *
   * When provided, Tailwind CSS is resolved relative to this path; otherwise,
   * it is resolved relative to `base`.
   */
  filepath?: string

  /**
   * Path to the Tailwind CSS config file (v3).
   *
   * Paths are resolved relative to `base`.
   */
  configPath?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+).
   *
   * Paths are resolved relative to `base`.
   */
  stylesheetPath?: string

  /**
   * Whether or not to preserve whitespace around classes.
   *
   * Default: false
   */
  preserveWhitespace?: boolean

  /**
   * Whether or not to preserve duplicate classes.
   *
   * Default: false
   */
  preserveDuplicates?: boolean

  /**
   * The package name to use when loading Tailwind CSS.
   *
   * Useful when multiple versions are installed in the same project.
   *
   * Default: `tailwindcss`
   *
   * @internal
   */
  packageName?: string
}

export interface Sorter {
  /**
   * Sort one or more class attributes.
   *
   * Each element is the value of an HTML `class` attribute (or similar). i.e. a
   * space separated list of class names as a string.
   */
  sortClassAttributes(classes: string[]): string[]

  /**
   * Sort one or more class lists.
   *
   * Each element is an array of class names. Passing a space separated class
   * list in each element is not supported.
   *
   * Duplicates are removed by default unless `preserveDuplicates` is enabled.
   */
  sortClassLists(classes: string[][]): string[][]
}

type TailwindConfigOptions = {
  base?: string
  filepath?: string
  configPath?: string
  stylesheetPath?: string
  packageName?: string
}

function resolveIfRelative(base: string, filePath?: string) {
  if (!filePath) return null
  return path.isAbsolute(filePath) ? filePath : path.resolve(base, filePath)
}

let pathToApiMap = expiringMap<string | null, Promise<UnifiedApi>>(10_000)

/**
 * Get a Tailwind CSS API instance based on the provided options.
 * @internal
 */
export async function getTailwindConfig(options: TailwindConfigOptions): Promise<UnifiedApi> {
  let base = options.base ?? process.cwd()
  let inputDir = options.filepath ? path.dirname(options.filepath) : base

  let configPath = resolveIfRelative(base, options.configPath)
  let stylesheetPath = resolveIfRelative(base, options.stylesheetPath)

  // Locate Tailwind CSS itself
  //
  // We resolve this like we're in `inputDir` for better monorepo support as
  // Prettier may be configured at the workspace root but Tailwind CSS is
  // installed for a workspace package rather than the entire monorepo
  let [mod, pkgDir] = await resolveTailwindPath({ packageName: options.packageName }, inputDir)

  // Locate project stylesheet relative to the formatter config file
  //
  // We resolve this relative to the config file because it is *required*
  // to work with a project's custom config. Given that, resolving it
  // relative to where the path is defined makes the most sense.
  let stylesheet = resolveStylesheet(stylesheetPath, base)

  // Locate *explicit* v3 configs relative to the formatter config file
  //
  // We use this as a signal that we should always use v3 to format files even
  // when the local install is v4 — which means we'll use the bundled v3.
  let jsConfig = resolveJsConfigPath(configPath)

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
  // 2. When explicit via `configPath`, relative to `base`
  if (!stylesheet && !mod?.__unstable__loadDesignSystem) {
    jsConfig = jsConfig ?? findClosestJsConfig(inputDir)
  }

  // We've found a JS config either because it was specified by the user
  // or because it was automatically located. This means we should use v3.
  if (jsConfig) {
    if (!stylesheet) {
      // If the config was explicitly provided, always use v3
      let explicitConfig = !!configPath

      return pathToApiMap.remember(`${pkgDir}:${jsConfig}`, async () => {
        const { loadV3 } = await import('./versions/v3')

        try {
          return await loadV3(pkgDir, jsConfig)
        } catch (err) {
          // If loading an auto-detected config fails with stack overflow (often caused
          // by jiti-based configs like unbuild stubs), fall back to bundled v4.
          // This commonly occurs in monorepos where a shared tailwind config package
          // uses unbuild --stub mode.
          if (!explicitConfig && err instanceof RangeError && err.message.includes('call stack')) {
            console.warn(
              'v3-config-load-failed',
              base,
              `Failed to load auto-detected Tailwind CSS config at ${jsConfig}. Falling back to bundled v4.`,
            )
            const { loadV4 } = await import('./versions/v4')
            return loadV4(null, null)
          }
          console.error(
            'v3-config-load-error',
            base,
            `Unable to load Tailwind CSS v3 config at ${jsConfig}.`,
          )
          throw err
        }
      })
    }

    // In this case the user explicitly gave us a stylesheet and a config.
    // Warn them about this and use the bundled v4.
    console.error(
      'explicit-stylesheet-and-config-together',
      base,
      `You have specified a Tailwind CSS stylesheet and a Tailwind CSS config at the same time. Use stylesheetPath unless you are using v3. Preferring the stylesheet.`,
    )
  }

  if (mod && !mod.__unstable__loadDesignSystem) {
    if (!stylesheet) {
      return pathToApiMap.remember(`${pkgDir}:${jsConfig}`, async () => {
        const { loadV3 } = await import('./versions/v3')
        return loadV3(pkgDir, jsConfig)
      })
    }

    // In this case the user explicitly gave us a stylesheet but their local
    // installation is not v4. We'll fallback to the bundled v4 in this case.
    mod = null
    console.error(
      'stylesheet-unsupported',
      base,
      'You have specified a Tailwind CSS stylesheet but your installed version of Tailwind CSS does not support this feature.',
    )
  }

  // If we've detected a local version of v4 then we should fallback to using
  // its included theme as the stylesheet if the user didn't give us one.
  if (mod && mod.__unstable__loadDesignSystem && pkgDir) {
    stylesheet ??= `${pkgDir}/theme.css`
  }

  return pathToApiMap.remember(`${pkgDir}:${stylesheet}`, async () => {
    const { loadV4 } = await import('./versions/v4')
    return loadV4(mod, stylesheet)
  })
}

let resolvedModCache = expiringMap<string, [any, string | null]>(10_000)

async function resolveTailwindPath(
  options: { packageName?: string },
  baseDir: string,
): Promise<[any, string | null]> {
  let pkgName = options.packageName ?? 'tailwindcss'
  let makeKey = (dir: string) => `${pkgName}:${dir}`

  // Check cache for this directory
  let cached = resolvedModCache.get(makeKey(baseDir))
  if (cached !== undefined) {
    return cached
  }

  let resolve = async () => {
    let pkgDir: string | null = null
    let mod: any = null

    try {
      let pkgPath = resolveJsFrom(baseDir, pkgName)
      mod = await import(pathToFileURL(pkgPath).toString())

      let pkgFile = resolveJsFrom(baseDir, `${pkgName}/package.json`)
      pkgDir = path.dirname(pkgFile)
    } catch {}

    return [mod, pkgDir] as [any, string | null]
  }

  let result = await resolve()

  // Cache all directories from baseDir up to package location
  let [, pkgDir] = result
  if (pkgDir) {
    cacheForDirs(resolvedModCache, baseDir, result, pkgDir, makeKey)
  } else {
    resolvedModCache.set(makeKey(baseDir), result)
  }

  return result
}

function resolveJsConfigPath(configPath: string | null): string | null {
  if (!configPath) return null
  if (configPath.endsWith('.css')) return null
  return configPath
}

let configPathCache = new Map<string, string | null>()

function findClosestJsConfig(inputDir: string): string | null {
  // Check cache for this directory
  let cached = configPathCache.get(inputDir)
  if (cached !== undefined) {
    return cached
  }

  // Resolve
  let configPath: string | null = null
  try {
    let foundPath = escalade(inputDir, (_, names) => {
      if (names.includes('tailwind.config.js')) return 'tailwind.config.js'
      if (names.includes('tailwind.config.cjs')) return 'tailwind.config.cjs'
      if (names.includes('tailwind.config.mjs')) return 'tailwind.config.mjs'
      if (names.includes('tailwind.config.ts')) return 'tailwind.config.ts'
    })
    configPath = foundPath ?? null
  } catch {}

  // Cache all directories from inputDir up to config location
  if (configPath) {
    cacheForDirs(configPathCache, inputDir, configPath, path.dirname(configPath))
  } else {
    configPathCache.set(inputDir, null)
  }

  return configPath
}

function resolveStylesheet(stylesheetPath: string | null, base: string): string | null {
  if (!stylesheetPath) return null

  if (
    stylesheetPath.endsWith('.js') ||
    stylesheetPath.endsWith('.mjs') ||
    stylesheetPath.endsWith('.cjs') ||
    stylesheetPath.endsWith('.ts') ||
    stylesheetPath.endsWith('.mts') ||
    stylesheetPath.endsWith('.cts')
  ) {
    console.error(
      'stylesheet-is-js-file',
      base,
      "Your `stylesheetPath` option points to a JS/TS config file. You must point to your project's `.css` file for v4 projects.",
    )
  } else if (
    stylesheetPath.endsWith('.sass') ||
    stylesheetPath.endsWith('.scss') ||
    stylesheetPath.endsWith('.less') ||
    stylesheetPath.endsWith('.styl')
  ) {
    console.error(
      'stylesheet-is-preprocessor-file',
      base,
      'Your `stylesheetPath` option points to a preprocessor file. This is unsupported and you may get unexpected results.',
    )
  } else if (!stylesheetPath.endsWith('.css')) {
    console.error(
      'stylesheet-is-not-css-file',
      base,
      'Your `stylesheetPath` option does not point to a CSS file. This is unsupported and you may get unexpected results.',
    )
  }

  return stylesheetPath
}

/**
 * Creates a sorter instance for sorting Tailwind CSS classes.
 *
 * This function initializes a sorter with the specified Tailwind CSS configuration.
 * The sorter can be used to sort class attributes (space-separated strings) or
 * class lists (arrays of class names).

 * @example
 * ```ts
 * const sorter = await createSorter({})
 *
 * // Sort class lists
 * const sorted = sorter.sortClassLists([['p-4', 'm-2']])
 * // Returns: [['m-2', 'p-4']]
 * ```
 */
export async function createSorter(opts: SorterOptions): Promise<Sorter> {
  let preserveDuplicates = opts.preserveDuplicates ?? false
  let preserveWhitespace = opts.preserveWhitespace ?? false

  let api = await getTailwindConfig({
    base: opts.base,
    filepath: opts.filepath,
    configPath: opts.configPath,
    stylesheetPath: opts.stylesheetPath,
    packageName: opts.packageName,
  })

  let env: TransformerEnv = {
    context: api,
    changes: [],
    options: {
      tailwindPreserveWhitespace: preserveWhitespace,
      tailwindPreserveDuplicates: preserveDuplicates,
      tailwindPackageName: opts.packageName,
    } as any,
    matcher: undefined as any,
  }

  return {
    sortClassLists(classes) {
      return classes.map((list) => {
        let result = sortClassList({
          api,
          classList: list,
          removeDuplicates: !preserveDuplicates,
        })

        return result.classList
      })
    },

    sortClassAttributes(classes) {
      return classes.map((list) => sortClasses(list, { env }))
    },
  }
}
