import { loadIfExists } from './utils.js'

let compatiblePlugins = [
  '@ianvs/prettier-plugin-sort-imports',
  '@trivago/prettier-plugin-sort-imports',
  'prettier-plugin-organize-imports',
  '@prettier/plugin-pug',
  '@shopify/prettier-plugin-liquid',
  'prettier-plugin-css-order',
  'prettier-plugin-import-sort',
  'prettier-plugin-jsdoc',
  'prettier-plugin-organize-attributes',
  'prettier-plugin-style-order',
  'prettier-plugin-twig-melody',
]

let additionalParserPlugins = [
  'prettier-plugin-astro',
  'prettier-plugin-svelte',
  'prettier-plugin-twig-melody',
  '@prettier/plugin-pug',
  '@shopify/prettier-plugin-liquid',
  'prettier-plugin-marko',
]

let additionalPrinterPlugins = [
  {
    pkg: 'prettier-plugin-svelte',
    formats: ['svelte-ast'],
  },
]

// ---

/** @type {Map<string, any>} */
let parserMap = new Map()
let isTesting = process.env.NODE_ENV === 'test'

export function getCompatibleParser(base, parserFormat, options) {
  if (parserMap.has(parserFormat) && !isTesting) {
    return parserMap.get(parserFormat)
  }

  let parser = getFreshCompatibleParser(base, parserFormat, options)
  parserMap.set(parserFormat, parser)
  return parser
}

function getFreshCompatibleParser(base, parserFormat, options) {
  if (!options.plugins) {
    return base.parsers[parserFormat]
  }

  let parser = {
    ...base.parsers[parserFormat],
  }

  // Now load parsers from plugins
  for (const name of compatiblePlugins) {
    let path = null

    try {
      path = require.resolve(name)
    } catch (err) {
      continue
    }

    let plugin = options.plugins.find(
      (plugin) => plugin.name === name || plugin.name === path,
    )

    // The plugin is not loaded
    if (!plugin) {
      continue
    }

    Object.assign(parser, plugin.parsers[parserFormat])
  }

  return parser
}

// We need to load this plugin dynamically because it's not available by default
// And we are not bundling it with the main Prettier plugin
export function getAdditionalParsers() {
  let parsers = {}

  for (const pkg of additionalParserPlugins) {
    Object.assign(parsers, loadIfExists(pkg)?.parsers ?? {})
  }

  return parsers
}

export function getAdditionalPrinters() {
  let printers = {}

  for (let { pkg, formats } of additionalPrinterPlugins) {
    let pluginPrinters = loadIfExists(pkg)?.printers
    for (let format of formats) {
      if (pluginPrinters && format in pluginPrinters) {
        printers[format] = pluginPrinters[format]
      }
    }
  }

  return printers
}
