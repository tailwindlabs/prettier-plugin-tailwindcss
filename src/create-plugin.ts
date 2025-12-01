import type { Parser, ParserOptions, Plugin, Printer } from 'prettier'
import { getTailwindConfig } from './config'
import { createMatcher } from './options'
import { loadIfExists, maybeResolve } from './resolve'
import type { TransformOptions } from './transform'
import type { TransformerEnv, TransformerMetadata } from './types'

export function createPlugin(transforms: TransformOptions<any>[]) {
  // Prettier parsers and printers may be async functions at definition time.
  // They'll be awaited when the plugin is loaded but must also be swapped out
  // with the resolved value before returning as later Prettier internals
  // assume that parsers and printers are objects and not functions.
  type Init<T> = (() => Promise<T | undefined>) | T | undefined

  let parsers: Record<string, Init<Parser<any>>> = Object.create(null)
  let printers: Record<string, Init<Printer<any>>> = Object.create(null)

  for (let opts of transforms) {
    for (let [name, meta] of Object.entries(opts.parsers)) {
      parsers[name] = async () => {
        let plugin = await loadPlugins(meta.load ?? opts.load ?? [])
        let original = plugin.parsers?.[name]
        if (!original) return

        // Now load parsers from "compatible" plugins if any
        let compatible: { pluginName: string; mod: Plugin<any> }[] = []

        for (let pluginName of opts.compatible ?? []) {
          compatible.push({
            pluginName,
            mod: await loadIfExistsESM(pluginName),
          })
        }

        // TODO: Find a way to drop this. We have to do this for compatible
        // plugins that are intended to override builtin ones
        parsers[name] = await createParser({
          original,
          transform: opts.transform,
          meta: {
            staticAttrs: meta.staticAttrs ?? opts.staticAttrs ?? [],
            dynamicAttrs: meta.dynamicAttrs ?? opts.dynamicAttrs ?? [],
          },

          loadCompatible(options) {
            let parser: Parser<any> = { ...original }

            for (let { pluginName, mod } of compatible) {
              let plugin = findEnabledPlugin(options, pluginName, mod)
              if (plugin) Object.assign(parser, plugin.parsers[name])
            }

            return parser
          },
        })

        return parsers[name]
      }
    }

    for (let [name, meta] of Object.entries(opts.printers ?? {})) {
      if (!opts.reprint) continue

      printers[name] = async () => {
        let plugin = await loadPlugins(meta.load ?? opts.load ?? [])
        let original = plugin.printers?.[name]
        if (!original) return

        printers[name] = createPrinter({
          original,
          reprint: opts.reprint!,
        })

        return printers[name]
      }
    }
  }

  return { parsers, printers }
}

async function loadPlugins<T>(fns: string[]) {
  let plugin: Plugin<T> = {
    parsers: Object.create(null),
    printers: Object.create(null),
    options: Object.create(null),
    defaultOptions: Object.create(null),
    languages: [],
  }

  for (let moduleName of fns) {
    try {
      let loaded = await loadIfExistsESM(moduleName)
      Object.assign(plugin.parsers!, loaded.parsers ?? {})
      Object.assign(plugin.printers!, loaded.printers ?? {})
      Object.assign(plugin.options!, loaded.options ?? {})
      Object.assign(plugin.defaultOptions!, loaded.defaultOptions ?? {})

      plugin.languages = [...(plugin.languages ?? []), ...(loaded.languages ?? [])]
    } catch (err) {
      throw err
    }
  }

  return plugin
}

async function loadIfExistsESM(name: string): Promise<Plugin<any>> {
  let mod = await loadIfExists<Plugin<any>>(name)

  return (
    mod ?? {
      parsers: {},
      printers: {},
      languages: [],
      options: {},
      defaultOptions: {},
    }
  )
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

async function createParser({
  original,
  loadCompatible,
  meta,
  transform,
}: {
  original: Parser<any>
  meta: TransformerMetadata
  loadCompatible: (options: ParserOptions) => Parser<any>
  transform: NonNullable<TransformOptions<any>['transform']>
}) {
  let parser: Parser<any> = { ...original }

  // TODO: Prettier v3.6.2+ allows preprocess to be async however this breaks
  // - Astro
  // - prettier-plugin-multiline-arrays
  // - @trivago/prettier-plugin-sort-imports
  // - prettier-plugin-jsdoc
  parser.preprocess = (code: string, options: ParserOptions) => {
    let parser = loadCompatible(options)

    return parser.preprocess ? parser.preprocess(code, options) : code
  }

  parser.parse = async (code, options) => {
    let original = loadCompatible(options)

    // @ts-expect-error: `options` is passed twice for compat with older plugins that were written
    // for Prettier v2 but still work with v3.
    //
    // Currently only the Twig plugin requires this.
    let ast = await original.parse(code, options, options)

    let context = await getTailwindConfig(options)

    let matcher = createMatcher(options, options.parser as string, {
      staticAttrs: new Set(meta.staticAttrs ?? []),
      dynamicAttrs: new Set(meta.dynamicAttrs ?? []),
      functions: new Set(),
      staticAttrsRegex: [],
      dynamicAttrsRegex: [],
      functionsRegex: [],
    })

    let env: TransformerEnv = {
      context,
      matcher,
      options,
      changes: [],
    }

    transform(ast, env)

    if (options.parser === 'svelte') {
      ast.changes = env.changes
    }

    return ast
  }

  return parser
}

function createPrinter({
  original,
  reprint,
}: {
  original: Printer<any>
  reprint: NonNullable<TransformOptions<any>['reprint']>
}) {
  let printer: Printer<any> = { ...original }

  // Hook into the preprocessing phase to load the config
  printer.print = new Proxy(original.print, {
    apply(target, thisArg, args) {
      let [path, options] = args as Parameters<typeof original.print>
      reprint(path, options)
      return Reflect.apply(target, thisArg, args)
    },
  })

  if (original.embed) {
    printer.embed = new Proxy(original.embed, {
      apply(target, thisArg, args) {
        let [path, options] = args as Parameters<typeof original.embed>
        reprint(path, options as any)
        return Reflect.apply(target, thisArg, args)
      },
    })
  }

  return printer
}
