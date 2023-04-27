import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import * as path from 'path'
import prettier from 'prettier'
import resolveFrom from 'resolve-from'
import { generateRules as generateRulesFallback } from 'tailwindcss/lib/lib/generateRules'
import { createContext as createContextFallback } from 'tailwindcss/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss/loadConfig'
import resolveConfigFallback from 'tailwindcss/resolveConfig'

/** @type {Map<string, {context: any, generateRules: () => any, expiration: number}>} */
let contextMap = new Map()

export function getTailwindConfig(options) {
  let key = `${options.filepath}:${options.tailwindConfig ?? ''}`

  if (contextMap.has(key)) {
    let result = contextMap.get(key)
    if (new Date() <= result.expiration) {
      return result
    }
  }

  let prettierConfigPath = prettier.resolveConfigFile.sync(options.filepath)

  let { resolveConfig, createContext, generateRules, tailwindConfig } =
    getFreshTailwindConfig(options, prettierConfigPath)

  let expiration = new Date()
  expiration.setSeconds(expiration.getSeconds() + 10)

  let context = createContext(resolveConfig(tailwindConfig))
  let result = {
    context,
    generateRules,
    expiration,
  }

  contextMap.set(key, result)

  return result
}

function getFreshTailwindConfig(options, prettierConfigPath) {
  let createContext = createContextFallback
  let generateRules = generateRulesFallback
  let resolveConfig = resolveConfigFallback
  let loadConfig = loadConfigFallback
  let baseDir
  let tailwindConfigPath = '__default__'
  let tailwindConfig = {}

  if (options.tailwindConfig) {
    baseDir = prettierConfigPath
      ? path.dirname(prettierConfigPath)
      : process.cwd()
  } else {
    baseDir = prettierConfigPath
      ? path.dirname(prettierConfigPath)
      : options.filepath
      ? path.dirname(options.filepath)
      : process.cwd()
  }

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

  if (options.tailwindConfig) {
    tailwindConfigPath = path.resolve(baseDir, options.tailwindConfig)
    clearModule(tailwindConfigPath)
    const loadedConfig = loadConfig(tailwindConfigPath)
    tailwindConfig = loadedConfig.default ?? loadedConfig
  } else {
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
      tailwindConfigPath = configPath
      clearModule(tailwindConfigPath)
      const loadedConfig = loadConfig(tailwindConfigPath)
      tailwindConfig = loadedConfig.default ?? loadedConfig
    }
  }

  // suppress "empty content" warning
  tailwindConfig.content = ['no-op']

  return {
    resolveConfig,
    createContext,
    generateRules,
    tailwindConfig,
  }
}