import type { Parser, ParserOptions, Plugin, Printer } from 'prettier'
import { getTailwindConfig } from './config'
import { createMatcher } from './options'
import { loadIfExists, maybeResolve } from './resolve'
import type { TransformOptions } from './transform'
import type { TransformerEnv } from './types'
import { isAbsolute } from 'path'

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

        parsers[name] = await createParser({
          name,
          original,
          opts,
        })

        return parsers[name]
      }
    }

    for (let [name, meta] of Object.entries(opts.printers ?? {})) {
      printers[name] = async () => {
        let plugin = await loadPlugins(opts.load ?? [])
        let original = plugin.printers?.[name]
        if (!original) return

        printers[name] = createPrinter({
          original,
          opts,
        })

        return printers[name]
      }
    }
  }

  return { parsers, printers }
}

async function createParser({
  name,
  original,
  opts,
}: {
  name: string
  original: Parser<any>
  opts: TransformOptions<any>
}) {
  let parser: Parser<any> = { ...original }

  async function load(options: ParserOptions<any>) {
    let parser: Parser<any> = { ...original }

    for (const pluginName of opts.compatible || []) {
      let plugin = await findEnabledPlugin(options, pluginName)
      if (plugin?.parsers?.[name]) Object.assign(parser, plugin.parsers[name])
    }

    return parser
  }

  parser.preprocess = async (code: string, options: ParserOptions) => {
    let parser = await load(options)
    return parser.preprocess ? parser.preprocess(code, options) : code
  }

  parser.parse = async (code, options) => {
    let original = await load(options)

    // @ts-expect-error: `options` is passed twice for compat with older plugins that were written
    // for Prettier v2 but still work with v3.
    //
    // Currently only the Twig plugin requires this.
    let ast = await original.parse(code, options, options)

    let env = await loadTailwindCSS({ opts, options })

    transformAst({
      ast,
      env,
      opts,
      options,
    })

    options.__tailwindcss__ = env

    return ast
  }

  return parser
}

function createPrinter({
  original,
  opts,
}: {
  original: Printer<any>
  opts: TransformOptions<any>
}) {
  let printer: Printer<any> = { ...original }

  let reprint = opts.reprint

  // Hook into the preprocessing phase to load the config
  if (reprint) {
    printer.print = new Proxy(original.print, {
      apply(target, thisArg, args) {
        let [path, options] = args as Parameters<typeof original.print>
        let env = options.__tailwindcss__ as TransformerEnv
        reprint(path, { ...env, options: options })
        return Reflect.apply(target, thisArg, args)
      },
    })

    if (original.embed) {
      printer.embed = new Proxy(original.embed, {
        apply(target, thisArg, args) {
          let [path, options] = args as Parameters<typeof original.embed>
          let env = options.__tailwindcss__ as TransformerEnv
          reprint(path, { ...env, options: options as any })
          return Reflect.apply(target, thisArg, args)
        },
      })
    }
  }

  return printer
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

function findEnabledPlugin(options: ParserOptions<any>, name: string) {

  for (let plugin of options.plugins) {
    if (plugin instanceof URL) {
      if (plugin.protocol !== 'file:') continue
      if (plugin.hostname !== '') continue

      plugin = plugin.pathname
    } if (typeof plugin !== 'string') {
      if (!plugin.name) {
        continue
      }
      plugin = plugin.name
    }


    if (plugin === name || (isAbsolute(plugin) && plugin.includes(name) && maybeResolve(name) === plugin)) {
      return loadIfExistsESM(name)

    }
  }
}

async function loadTailwindCSS<T = any>({
  options,
  opts,
}: {
  options: ParserOptions<T>
  opts: TransformOptions<T>
}): Promise<TransformerEnv> {
  let parsers = opts.parsers
  let parser = options.parser as string

  let context = await getTailwindConfig(options)

  let matcher = createMatcher(options, parser, {
    staticAttrs: new Set(parsers[parser]?.staticAttrs ?? opts.staticAttrs ?? []),
    dynamicAttrs: new Set(parsers[parser]?.dynamicAttrs ?? opts.dynamicAttrs ?? []),
    functions: new Set(),
    staticAttrsRegex: [],
    dynamicAttrsRegex: [],
    functionsRegex: [],
  })

  return {
    context,
    matcher,
    options,
    changes: [],
  }
}

function transformAst<T = any>({
  ast,
  env,
  opts,
}: {
  ast: T
  env: TransformerEnv
  options: ParserOptions<T>
  opts: TransformOptions<T>
}) {
  let transform = opts.transform
  if (transform) transform(ast, env)
}
