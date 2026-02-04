// @ts-check
import * as path from 'node:path'
import prettier from 'prettier'
import type { ParserOptions } from 'prettier'
import * as console from './console'
import { expiringMap } from './expiring-map.js'
import { getTailwindConfig as getTailwindConfigFromLib } from './lib.js'
import type { UnifiedApi } from './types'

/**
 * Cache a value for all directories from `inputDir` up to `targetDir` (inclusive).
 * Stops early if an existing cache entry is found.
 */
function cacheForDirs<V>(
  cache: { set(key: string, value: V): void; get(key: string): V | undefined },
  inputDir: string,
  value: V,
  targetDir: string,
  makeKey: (dir: string) => string = (dir) => dir,
): void {
  let dir = inputDir
  while (dir !== path.dirname(dir) && dir.length >= targetDir.length) {
    const key = makeKey(dir)
    // Stop caching if we hit an existing entry
    if (cache.get(key) !== undefined) break

    cache.set(key, value)
    if (dir === targetDir) break
    dir = path.dirname(dir)
  }
}

let prettierConfigCache = expiringMap<string, string | null>(10_000)

async function resolvePrettierConfigPath(
  filePath: string,
  inputDir: string,
): Promise<[string, string | null]> {
  // Check cache for this directory
  let cached = prettierConfigCache.get(inputDir)
  if (cached !== undefined) {
    return cached ? [path.dirname(cached), cached] : [process.cwd(), null]
  }

  const resolve = async () => {
    try {
      return await prettier.resolveConfigFile(filePath)
    } catch (err) {
      console.error('prettier-config-not-found', 'Failed to resolve Prettier Config')
      console.error('prettier-config-not-found-err', err)
      return null
    }
  }

  let prettierConfig = await resolve()

  // Cache all directories from inputDir up to config location
  if (prettierConfig) {
    cacheForDirs(prettierConfigCache, inputDir, prettierConfig, path.dirname(prettierConfig))
  } else {
    prettierConfigCache.set(inputDir, null)
  }

  return prettierConfig ? [path.dirname(prettierConfig), prettierConfig] : [process.cwd(), null]
}

export async function getTailwindConfig(options: ParserOptions): Promise<UnifiedApi> {
  let cwd = process.cwd()
  let inputDir = options.filepath ? path.dirname(options.filepath) : cwd

  let [configDir, formatterConfigPath] = await resolvePrettierConfigPath(
    options.filepath,
    inputDir,
  )

  let base = formatterConfigPath ? path.dirname(formatterConfigPath) : configDir

  let configPath =
    options.tailwindConfig && !options.tailwindConfig.endsWith('.css')
      ? options.tailwindConfig
      : undefined

  let stylesheetPath = options.tailwindStylesheet
  if (!stylesheetPath && options.tailwindEntryPoint) {
    console.warn(
      'entrypoint-is-deprecated',
      formatterConfigPath ?? '',
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindEntryPoint`.',
    )
    stylesheetPath = options.tailwindEntryPoint
  }

  if (!stylesheetPath && options.tailwindConfig && options.tailwindConfig.endsWith('.css')) {
    console.warn(
      'config-as-css-is-deprecated',
      formatterConfigPath ?? '',
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindConfig`.',
    )
    stylesheetPath = options.tailwindConfig
  }

  return getTailwindConfigFromLib({
    base,
    formatterConfigPath: formatterConfigPath ?? undefined,
    filepath: options.filepath,
    configPath,
    stylesheetPath,
    packageName: options.tailwindPackageName,
  })
}
