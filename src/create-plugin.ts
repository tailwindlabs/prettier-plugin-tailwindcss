import type { AstPath, Parser, ParserOptions, Plugin, Printer } from 'prettier'
import { getTailwindConfig } from './config'
import { createMatcher, type Matcher } from './options'
import { loadIfExists, maybeResolve } from './resolve'
import { sortClasses } from './sorting'
import type { TransformerEnv } from './types'

export function defineTransform<T>(opts: TransformOptions<T>) {
  return opts
}

export interface SortOptions {
  ignoreFirst?: boolean
  ignoreLast?: boolean
  removeDuplicates?: boolean
  collapseWhitespace?: { start: boolean; end: boolean }
}

export interface Env<T> {
  /**
   * The options passed from Prettier
   */
  options: ParserOptions<T>

  /**
   * Determine if specific attribute or functions should be sorted
   */
  matcher: Matcher

  /**
   * Sort a class list according to the associated Tailwind CSS project
   */
  sort: (classes: string, options?: SortOptions) => string

  env: TransformerEnv
}

export interface TransformOptions<T> {
  /**
   * A list of supported parser names
   */
  parsers: Record<
    string,
    {
      /**
       * Load the given plugins for this parser
       */
      load: string[]

      /**
       * A list of compatible, third-party plugins for this transformation step
       *
       * The loading of these is delayed until the actual parse call as
       * using the parse() function from these plugins may cause errors
       * if they haven't already been loaded by Prettier.
       */
      compatible?: string[]

      /**
       * Static attributes that are supported by default
       */
      staticAttrs?: string[]

      /**
       * Dynamic / expression attributes that are supported by default
       */
      dynamicAttrs?: string[]
    }
  >

  /**
   * A list of supported AST formats / printer names
   */
  printers: Record<
    string,
    {
      /**
       * Load the given plugins to provide the printer
       */
      load: string[]
    }
  >

  /**
   * Transform each AST node to sort classes
   *
   * @param path The path from the root to the AST node
   * @param env  Provides options and mechanisms to sort classes
   */
  reprint(path: AstPath<T>, env: Env<T>): void
}

export async function loadPlugins<T>(fns: string[]) {
  let plugin: Plugin<T> = {
    parsers: Object.create(null),
    printers: Object.create(null),
    languages: Object.create(null),
    options: Object.create(null),
    defaultOptions: Object.create(null),
  }

  for (let moduleName of fns) {
    try {
      let loaded = await import(moduleName)
      Object.assign(plugin.parsers!, loaded.parsers ?? {})
      Object.assign(plugin.printers!, loaded.printers ?? {})
      Object.assign(plugin.languages!, loaded.languages ?? {})
      Object.assign(plugin.options!, loaded.options ?? {})
      Object.assign(plugin.defaultOptions!, loaded.defaultOptions ?? {})
    } catch {}
  }

  return plugin
}

export function createPlugin(transformers: TransformOptions<any>[]) {
  type Init<T> = (() => Promise<T | undefined>) | T | undefined

  let parsers: Record<string, Init<Parser<any>>> = Object.create(null)
  let printers: Record<string, Init<Printer<any>>> = Object.create(null)

  for (let opts of transformers) {
    for (let [name, details] of Object.entries(opts.parsers)) {
      parsers[name] = async () => {
        let plugin = await loadPlugins(details.load)
        let original = plugin.parsers?.[name]
        if (!original) return

        // TODO: Find a way to drop this. We have to do this for compatible
        // plugins that are intended to override builtin ones
        parsers[name] = {
          ...original,
          parse: async (code, options) => {
            let parser = { ...original }

            // Now load parsers from "compatible" plugins if any
            for (let pluginName of details.compatible ?? []) {
              let mod = await loadIfExistsESM(pluginName)
              let plugin = findEnabledPlugin(options, pluginName, mod)
              if (!plugin) continue
              Object.assign(parser, plugin.parsers[name])
            }

            return await parser.parse(code, options)
          },
        }

        return parsers[name]
      }
    }

    for (let [name, details] of Object.entries(opts.printers)) {
      printers[name] = async () => {
        let plugin = await loadPlugins(details.load)
        let original = plugin.printers?.[name]
        if (!original) return

        // TODO: we should get the original version _not from this plugin_
        // from the options passed into the print method
        //
        // The problem is that even if we do that how do we get at
        // the top-level properties?
        printers[name] = wrapPrinter(original, opts)

        return printers[name]
      }
    }
  }

  return { parsers, printers }
}

async function loadIfExistsESM(name: string): Promise<Plugin<any>> {
  let mod = await loadIfExists<Plugin<any>>(name)
  return mod ?? { parsers: {}, printers: {} }
}

function findEnabledPlugin(options: ParserOptions<any>, name: string, mod: any) {
  let path = maybeResolve(name)

  for (let plugin of options.plugins) {
    if (plugin instanceof URL) {
      if (plugin.protocol !== 'file:') continue
      if (plugin.hostname !== '') continue

      plugin = plugin.pathname
    }

    if (typeof plugin === 'string') {
      if (plugin === name || plugin === path) {
        return mod
      }

      continue
    }

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
}

function wrapPrinter(original: Printer<any>, opts: TransformOptions<any>) {
  let printer: Printer<any> = { ...original }

  // Hook into the preprocessing phase to load the config
  printer.preprocess = async (ast, options) => {
    let parser = options.parser as string

    let matcher = createMatcher(options, parser, {
      staticAttrs: new Set(opts.parsers[parser]?.staticAttrs ?? []),
      dynamicAttrs: new Set(opts.parsers[parser]?.dynamicAttrs ?? []),
      functions: new Set(),
      staticAttrsRegex: [],
      dynamicAttrsRegex: [],
      functionsRegex: [],
    })

    let context = await getTailwindConfig(options)

    let transformerEnv = { context, parsers: {}, matcher, options }

    let env: Env<any> = {
      options,
      matcher,
      env: transformerEnv,
      sort(classes, opts) {
        return sortClasses(classes, {
          ...opts,
          env: transformerEnv,
        })
      },
    }

    options.__tailwindcss__ = env

    return original.preprocess?.(ast, options) ?? ast
  }

  printer.print = (path, options, print, args) => {
    opts.reprint(path, options.__tailwindcss__ as Env<any>)

    return original.print(path, options, print, args)
  }

  if (original.embed) {
    printer.embed = (path, options) => {
      opts.reprint(path, options.__tailwindcss__ as Env<any>)

      return original.embed!(path, options)
    }
  }

  return printer
}
