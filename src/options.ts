import type { RequiredOptions, SupportOption } from 'prettier'
import type { Customizations } from './types'

export const options: Record<string, SupportOption> = {
  tailwindConfig: {
    type: 'string',
    category: 'Tailwind CSS',
    description: 'Path to Tailwind configuration file',
  },

  tailwindEntryPoint: {
    type: 'string',
    category: 'Tailwind CSS',
    description: 'Path to the CSS entrypoint in your Tailwind project (v4+)',

    // Can't include this otherwise the option is not passed to parsers
    // deprecated: "This option is deprecated. Use 'tailwindStylesheet' instead.",
  },

  tailwindStylesheet: {
    type: 'string',
    category: 'Tailwind CSS',
    description: 'Path to the CSS stylesheet in your Tailwind project (v4+)',
  },

  tailwindAttributes: {
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description: 'List of attributes/props that contain sortable Tailwind classes',
  },

  tailwindFunctions: {
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description: 'List of functions and tagged templates that contain sortable Tailwind classes',
  },

  tailwindPreserveWhitespace: {
    type: 'boolean',
    default: false,
    category: 'Tailwind CSS',
    description: 'Preserve whitespace around Tailwind classes when sorting',
  },

  tailwindPreserveDuplicates: {
    type: 'boolean',
    default: false,
    category: 'Tailwind CSS',
    description: 'Preserve duplicate classes inside a class list when sorting',
  },

  tailwindPackageName: {
    type: 'string',
    default: 'tailwindcss',
    category: 'Tailwind CSS',
    description: 'The package name to use when loading Tailwind CSS',
  },
}

export interface Matcher {
  hasStaticAttr(name: string): boolean
  hasDynamicAttr(name: string): boolean
  hasFunction(name: string): boolean
}

export function createMatcher(options: RequiredOptions, parser: string, defaults: Customizations): Matcher {
  let staticAttrs = new Set<string>(defaults.staticAttrs)
  let dynamicAttrs = new Set<string>(defaults.dynamicAttrs)
  let functions = new Set<string>(defaults.functions)
  let staticAttrsRegex: RegExp[] = [...defaults.staticAttrsRegex]
  let dynamicAttrsRegex: RegExp[] = [...defaults.dynamicAttrsRegex]
  let functionsRegex: RegExp[] = [...defaults.functionsRegex]

  // Create a list of "static" attributes
  for (let attr of options.tailwindAttributes ?? []) {
    let regex = parseRegex(attr)

    if (regex) {
      staticAttrsRegex.push(regex)
    } else if (parser === 'vue' && attr.startsWith(':')) {
      staticAttrs.add(attr.slice(1))
    } else if (parser === 'vue' && attr.startsWith('v-bind:')) {
      staticAttrs.add(attr.slice(7))
    } else if (parser === 'vue' && attr.startsWith('v-')) {
      dynamicAttrs.add(attr)
    } else if (parser === 'angular' && attr.startsWith('[') && attr.endsWith(']')) {
      staticAttrs.add(attr.slice(1, -1))
    } else {
      staticAttrs.add(attr)
    }
  }

  // Generate a list of dynamic attributes
  for (let attr of staticAttrs) {
    if (parser === 'vue') {
      dynamicAttrs.add(`:${attr}`)
      dynamicAttrs.add(`v-bind:${attr}`)
    } else if (parser === 'angular') {
      dynamicAttrs.add(`[${attr}]`)
    }
  }

  for (let regex of staticAttrsRegex) {
    if (parser === 'vue') {
      dynamicAttrsRegex.push(new RegExp(`:${regex.source}`, regex.flags))
      dynamicAttrsRegex.push(new RegExp(`v-bind:${regex.source}`, regex.flags))
    } else if (parser === 'angular') {
      dynamicAttrsRegex.push(new RegExp(`\\[${regex.source}\\]`, regex.flags))
    }
  }

  // Generate a list of supported functions
  for (let fn of options.tailwindFunctions ?? []) {
    let regex = parseRegex(fn)

    if (regex) {
      functionsRegex.push(regex)
    } else {
      functions.add(fn)
    }
  }

  return {
    hasStaticAttr: (name: string) => hasMatch(name, staticAttrs, staticAttrsRegex),
    hasDynamicAttr: (name: string) => hasMatch(name, dynamicAttrs, dynamicAttrsRegex),
    hasFunction: (name: string) => hasMatch(name, functions, functionsRegex),
  }
}

/**
 * Check for matches against a static list or possible regex patterns
 */
function hasMatch(name: string, list: Set<string>, patterns: RegExp[]): boolean {
  if (list.has(name)) return true

  for (let regex of patterns) {
    if (regex.test(name)) return true
  }

  return false
}

function parseRegex(str: string): RegExp | null {
  if (!str.startsWith('/')) return null

  let lastSlash = str.lastIndexOf('/')
  if (str.lastIndexOf('/') <= 0) return null

  try {
    let pattern = str.slice(1, lastSlash)
    let flags = str.slice(lastSlash + 1)
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}
