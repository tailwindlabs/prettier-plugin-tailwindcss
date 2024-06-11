import type { RequiredOptions, SupportOption } from 'prettier'
import type { Customizations } from './types'
import './index'

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
  },

  tailwindAttributes: {
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description:
      'List of attributes/props that contain sortable Tailwind classes',
  },

  tailwindFunctions: {
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description:
      'List of functions and tagged templates that contain sortable Tailwind classes',
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
}

export function getCustomizations(
  options: RequiredOptions,
  parser: string,
  defaults: Customizations,
): Customizations {
  let staticAttrs = new Set<string>(defaults.staticAttrs)
  let dynamicAttrs = new Set<string>(defaults.dynamicAttrs)
  let functions = new Set<string>(defaults.functions)

  // Create a list of "static" attributes
  for (let attr of options.tailwindAttributes ?? []) {
    if (parser === 'vue' && attr.startsWith(':')) {
      staticAttrs.add(attr.slice(1))
    } else if (parser === 'vue' && attr.startsWith('v-bind:')) {
      staticAttrs.add(attr.slice(7))
    } else if (parser === 'vue' && attr.startsWith('v-')) {
      dynamicAttrs.add(attr)
    } else if (
      parser === 'angular' &&
      attr.startsWith('[') &&
      attr.endsWith(']')
    ) {
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

  // Generate a list of supported functions
  for (let fn of options.tailwindFunctions ?? []) {
    functions.add(fn)
  }

  return {
    functions,
    staticAttrs,
    dynamicAttrs,
  }
}
