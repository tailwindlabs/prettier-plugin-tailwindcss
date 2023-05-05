/** @type {Record<string, import('prettier').SupportOption>} */
export const options = {
  tailwindConfig: {
    since: '0.0.0',
    type: 'string',
    category: 'Tailwind CSS',
    description: 'Path to Tailwind configuration file',
  },
  tailwindAttributes: {
    since: '0.3.0',
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description:
      'List of attributes/props that contain sortable Tailwind classes',
  },
  tailwindFunctions: {
    since: '0.3.0',
    type: 'string',
    array: true,
    default: [{ value: [] }],
    category: 'Tailwind CSS',
    description:
      'List of functions and tagged templates that contain sortable Tailwind classes',
  },
}

/**
 * @typedef {object} RawOptions
 * @property {string | null} tailwindConfig
 * @property {string[]} tailwindFunctions
 * @property {string[]} tailwindAttributes
 */

/**
 * @typedef {object} Customizations
 * @property {Set<string>} functions
 * @property {Set<string>} staticAttrs
 * @property {Set<string>} dynamicAttrs
 */

/**
 * @param {RawOptions} options
 * @param {string} parser
 * @returns {Customizations}
 */
export function getCustomizations(options, parser) {
  /** @type {Set<string>} */
  let staticAttrs = new Set()

  /** @type {Set<string>} */
  let dynamicAttrs = new Set()

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
      dynamicAttrs.add(`:${attr.name}`)
      dynamicAttrs.add(`v-bind:${attr.name}`)
    } else if (parser === 'angular') {
      dynamicAttrs.add(`[${attr.name}]`)
    }
  }

  return {
    functions: new Set(options.tailwindFunctions),
    staticAttrs,
    dynamicAttrs,
  }
}
