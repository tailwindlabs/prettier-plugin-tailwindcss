// @ts-check
import * as path from 'path'
import clearModule from 'clear-module'
// @ts-ignore
import { generateRules as generateRulesFallback } from 'tailwindcss-v3/lib/lib/generateRules'
// @ts-ignore
import { createContext as createContextFallback } from 'tailwindcss-v3/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss-v3/loadConfig'
import resolveConfigFallback from 'tailwindcss-v3/resolveConfig'
import type { RequiredConfig } from 'tailwindcss-v3/types/config.js'
import type { UnifiedApi } from '../types'
import { bigSign } from '../utils'

interface LegacyTailwindContext {
  tailwindConfig: {
    prefix: string | ((selector: string) => string)
  }

  getClassOrder?: (classList: string[]) => [string, bigint | null][]

  layerOrder: {
    components: bigint
  }
}

interface GenerateRules {
  (classes: Iterable<string>, context: LegacyTailwindContext): [bigint][]
}

function prefixCandidate(context: LegacyTailwindContext, selector: string): string {
  let prefix = context.tailwindConfig.prefix
  return typeof prefix === 'function' ? prefix(selector) : prefix + selector
}

export async function loadV3(pkgDir: string | null, jsConfig: string | null): Promise<UnifiedApi> {
  let createContext = createContextFallback
  let generateRules: GenerateRules = generateRulesFallback
  let resolveConfig = resolveConfigFallback
  let loadConfig = loadConfigFallback
  let tailwindConfig: RequiredConfig = { content: [] }

  try {
    if (pkgDir) {
      resolveConfig = require(path.join(pkgDir, 'resolveConfig'))
      createContext = require(path.join(pkgDir, 'lib/lib/setupContextUtils')).createContext
      generateRules = require(path.join(pkgDir, 'lib/lib/generateRules')).generateRules
      // Prior to `tailwindcss@3.3.0` this won't exist so we load it last
      loadConfig = require(path.join(pkgDir, 'loadConfig'))
    }
  } catch {}

  try {
    if (jsConfig) {
      clearModule(jsConfig)
      let loadedConfig = loadConfig(jsConfig)
      tailwindConfig = loadedConfig.default ?? loadedConfig
    }
  } catch (err) {
    console.error(`Unable to load your Tailwind CSS v3 config: ${jsConfig}`)
    throw err
  }

  // suppress "empty content" warning
  tailwindConfig.content = ['no-op']

  // Create the context
  let context: LegacyTailwindContext = createContext(resolveConfig(tailwindConfig))

  // Polyfill for older Tailwind CSS versions
  function getClassOrderPolyfill(classes: string[]): [string, bigint | null][] {
    // A list of utilities that are used by certain Tailwind CSS utilities but
    // that don't exist on their own. This will result in them "not existing" and
    // sorting could be weird since you still require them in order to make the
    // host utitlies work properly. (Thanks Biology)
    let parasiteUtilities = new Set([prefixCandidate(context, 'group'), prefixCandidate(context, 'peer')])

    let classNamesWithOrder: [string, bigint | null][] = []

    for (let className of classes) {
      let order: bigint | null =
        generateRules(new Set([className]), context).sort(([a], [z]) => bigSign(z - a))[0]?.[0] ?? null

      if (order === null && parasiteUtilities.has(className)) {
        // This will make sure that it is at the very beginning of the
        // `components` layer which technically means 'before any
        // components'.
        order = context.layerOrder.components
      }

      classNamesWithOrder.push([className, order])
    }

    return classNamesWithOrder
  }

  context.getClassOrder ??= getClassOrderPolyfill

  return {
    getClassOrder: (classList: string[]) => {
      return context.getClassOrder ? context.getClassOrder(classList) : getClassOrderPolyfill(classList)
    },
  }
}
