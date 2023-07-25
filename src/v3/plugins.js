import { createRequire as req } from 'module'
import * as prettierParserAcorn from 'prettier/plugins/acorn'
import * as prettierParserBabel from 'prettier/plugins/babel'
import * as prettierParserFlow from 'prettier/plugins/flow'
import * as prettierParserGlimmer from 'prettier/plugins/glimmer'
import * as prettierParserHTML from 'prettier/plugins/html'
import * as prettierParserMeriyah from 'prettier/plugins/meriyah'
import * as prettierParserPostCSS from 'prettier/plugins/postcss'
import * as prettierParserTypescript from 'prettier/plugins/typescript'

/**
 * @typedef {object} PluginDetails
 * @property {Record<string, import('prettier').Parser<any>>} parsers
 * @property {Record<string, import('prettier').Printer<any>>} printers
 */

/**
 * @returns {Promise<import('prettier').Plugin<any>>}
 */
async function loadIfExistsESM(name) {
  try {
    if (createRequire(import.meta.url).resolve(name)) {
      let mod = await import(name)
      return mod.default ?? mod
    }
  } catch (e) {
    return {
      parsers: {},
      printers: {},
    }
  }
}

export async function loadPlugins() {
  const builtin = await loadBuiltinPlugins()
  const thirdparty = await loadThirdPartyPlugins()
  const compatible = await loadCompatiblePlugins()

  let parsers = {
    ...builtin.parsers,
    ...thirdparty.parsers,
  }

  let printers = {
    ...builtin.printers,
    ...thirdparty.printers,
  }

  function maybeResolve(name) {
    try {
      return req.resolve(name)
    } catch (err) {
      return null
    }
  }

  function findEnabledPlugin(options, name, mod) {
    let path = maybeResolve(name)

    for (let plugin of options.plugins) {
      // options.plugins.*.name == name
      if (plugin.name === name) {
        return mod
      }

      // options.plugins.*.name == path
      if (plugin.name === path) {
        return mod
      }

      // basically options.plugins.* == mod
      // But that can't work because prettier normalizes plugins which destroys top-level object identity
      if (plugin.parsers && mod.parsers && plugin.parsers == mod.parsers) {
        return mod
      }
    }

    return null
  }

  return {
    parsers,
    printers,

    originalParser(format, options) {
      if (!options.plugins) {
        return parsers[format]
      }

      let parser = { ...parsers[format] }

      // Now load parsers from "compatible" plugins if any
      for (const { name, mod } of compatible) {
        let plugin = findEnabledPlugin(options, name, mod)
        if (plugin) {
          Object.assign(parser, plugin.parsers[format])
        }
      }

      return parser
    },
  }
}

/**
 *
 * @returns {Promise<PluginDetails}>}
 */
async function loadBuiltinPlugins() {
  return {
    parsers: {
      html: prettierParserHTML.parsers.html,
      glimmer: prettierParserGlimmer.parsers.glimmer,
      lwc: prettierParserHTML.parsers.lwc,
      angular: prettierParserHTML.parsers.angular,
      vue: prettierParserHTML.parsers.vue,
      css: prettierParserPostCSS.parsers.css,
      scss: prettierParserPostCSS.parsers.scss,
      less: prettierParserPostCSS.parsers.less,
      babel: prettierParserBabel.parsers.babel,
      'babel-flow': prettierParserBabel.parsers['babel-flow'],
      flow: prettierParserFlow.parsers.flow,
      typescript: prettierParserTypescript.parsers.typescript,
      'babel-ts': prettierParserBabel.parsers['babel-ts'],
      acorn: prettierParserAcorn.parsers.acorn,
      meriyah: prettierParserMeriyah.parsers.meriyah,
      __js_expression: prettierParserBabel.parsers.__js_expression,
    },
    printers: {
      //
    },
  }
}

/**
 * @returns {Promise<PluginDetails}>}
 */
async function loadThirdPartyPlugins() {
  // Commented out plugins do not currently work with Prettier v3.0
  let [astro, liquid, svelte] = await Promise.all([
    loadIfExistsESM('prettier-plugin-astro'),
    loadIfExistsESM('@shopify/prettier-plugin-liquid'),
    // loadIfExistsESM('prettier-plugin-marko'),
    // loadIfExistsESM('prettier-plugin-twig-melody'),
    // loadIfExistsESM('@prettier/plugin-pug'),
    loadIfExistsESM('prettier-plugin-svelte'),
  ])

  return {
    parsers: {
      ...astro.parsers,
      ...liquid.parsers,
      // ...marko.parsers,
      // ...melody.parsers,
      // ...pug.parsers,
      ...svelte.parsers,
    },
    printers: {
      ...svelte.printers,
    },
  }
}

async function loadCompatiblePlugins() {
  // Commented out plugins do not currently work with Prettier v3.0
  let plugins = [
    '@ianvs/prettier-plugin-sort-imports',
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-organize-imports',
    // 'prettier-plugin-css-order',
    // 'prettier-plugin-import-sort',
    'prettier-plugin-jsdoc',
    'prettier-plugin-organize-attributes',
    // 'prettier-plugin-style-order',
  ]

  // Load all the available compatible plugins up front
  // These are wrapped in try/catch internally so failure doesn't cause issues
  // Technically we're executing these plugins though
  // Even if not enabled
  // There is, unfortunately, no way around this currently
  return await Promise.all(
    plugins.map(async (name) => {
      let mod = await loadIfExistsESM(name)

      return {
        name,
        mod,
      }
    }),
  )
}
