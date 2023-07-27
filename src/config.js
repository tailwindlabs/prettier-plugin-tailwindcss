// @ts-check
import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import * as path from 'path'
import prettier from 'prettier'
import resolveFrom from 'resolve-from'
// @ts-ignore
import { generateRules as generateRulesFallback } from 'tailwindcss/lib/lib/generateRules'
// @ts-ignore
import { createContext as createContextFallback } from 'tailwindcss/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss/loadConfig'
import resolveConfigFallback from 'tailwindcss/resolveConfig'
import { expiringMap } from './expiring-map.js'

/** @typedef {import('prettier').ParserOptions} ParserOptions **/
/** @typedef {import('./types.js').ContextContainer} ContextContainer **/

/**
 * @template K
 * @template V
 * @typedef {import('./expiring-map.js').ExpiringMap<K,V>} ExpiringMap
 **/

/** @type {Map<string, string | null>} */
let sourceToPathMap = new Map()

/** @type {ExpiringMap<string | null, ContextContainer>} */
let pathToContextMap = expiringMap(10_000)

/** @type {ExpiringMap<string, string | null>} */
let prettierConfigCache = expiringMap(10_000)

/**
 * @param {ParserOptions} options
 * @returns {Promise<ContextContainer>}
 */
export async function getTailwindConfig(options) {
  let key = `${options.filepath}:${options.tailwindConfig ?? ''}`
  let baseDir = await getBaseDir(options)

  // Map the source file to it's associated Tailwind config file
  let configPath = sourceToPathMap.get(key)
  if (configPath === undefined) {
    configPath = getConfigPath(options, baseDir)
    sourceToPathMap.set(key, configPath)
  }

  // Now see if we've loaded the Tailwind config file before (and it's still valid)
  let existing = pathToContextMap.get(configPath)
  if (existing) {
    return existing
  }

  // By this point we know we need to load the Tailwind config file
  let result = loadTailwindConfig(baseDir, configPath)

  pathToContextMap.set(configPath, result)

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

  return prettierConfigPath
    ? path.dirname(prettierConfigPath)
    : options.filepath
    ? path.dirname(options.filepath)
    : process.cwd()
}

/**
 *
 * @param {string} baseDir
 * @param {string | null} tailwindConfigPath
 * @returns {ContextContainer}
 */
function loadTailwindConfig(baseDir, tailwindConfigPath) {
  let createContext = createContextFallback
  let generateRules = generateRulesFallback
  let resolveConfig = resolveConfigFallback
  let loadConfig = loadConfigFallback
  let tailwindConfig = {}

  try {
    let pkgDir = path.dirname(resolveFrom(baseDir, 'tailwindcss/package.json'))

    resolveConfig = require(path.join(pkgDir, 'resolveConfig'))
    createContext = require(path.join(
      pkgDir,
      'lib/lib/setupContextUtils',
    )).createContext
    generateRules = require(path.join(
      pkgDir,
      'lib/lib/generateRules',
    )).generateRules

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
    tailwindConfig,
    generateRules,
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
