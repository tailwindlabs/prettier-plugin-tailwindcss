// @ts-check
import * as path from 'node:path'
import prettier from 'prettier'
import type { ParserOptions } from 'prettier'
import * as console from './console'
import { expiringMap } from './expiring-map.js'
import { cacheForDirs, getTailwindConfig as getTailwindConfigFromLib } from './lib.js'
import type { UnifiedApi } from './types'

let prettierConfigCache = expiringMap<string, string | null>(10_000)

async function resolvePrettierConfigDir(
  filePath: string,
  inputDir: string,
): Promise<string> {
  // Check cache for this directory
  let cached = prettierConfigCache.get(inputDir)
  if (cached !== undefined) {
    return cached ?? process.cwd()
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
    let configDir = path.dirname(prettierConfig)
    cacheForDirs(prettierConfigCache, inputDir, configDir, configDir)
    return configDir
  } else {
    prettierConfigCache.set(inputDir, null)
    return process.cwd()
  }
}

export async function getTailwindConfig(options: ParserOptions): Promise<UnifiedApi> {
  let cwd = process.cwd()
  let inputDir = options.filepath ? path.dirname(options.filepath) : cwd

  let configDir = await resolvePrettierConfigDir(
    options.filepath,
    inputDir,
  )


  let configPath =
    options.tailwindConfig && !options.tailwindConfig.endsWith('.css')
      ? options.tailwindConfig
      : undefined

  let stylesheetPath = options.tailwindStylesheet
  if (!stylesheetPath && options.tailwindEntryPoint) {
    console.warn(
      'entrypoint-is-deprecated',
      configDir,
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindEntryPoint`.',
    )
    stylesheetPath = options.tailwindEntryPoint
  }

  if (!stylesheetPath && options.tailwindConfig && options.tailwindConfig.endsWith('.css')) {
    console.warn(
      'config-as-css-is-deprecated',
      configDir,
      'Deprecated: Use the `tailwindStylesheet` option for v4 projects instead of `tailwindConfig`.',
    )
    stylesheetPath = options.tailwindConfig
  }

  return getTailwindConfigFromLib({
    base: configDir,
    filepath: options.filepath,
    configPath,
    stylesheetPath,
    packageName: options.tailwindPackageName,
  })
}
