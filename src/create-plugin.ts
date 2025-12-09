import type { AstPath, Parser, ParserOptions, Printer } from 'prettier'
import { getTailwindConfig } from './config'
import { createMatcher } from './options'
import type { loadPlugins } from './plugins'
import type { TransformOptions } from './transform'
import type { Customizations, TransformerEnv, TransformerMetadata } from './types'

type Base = Awaited<ReturnType<typeof loadPlugins>>

export function createPlugin(base: Base, transforms: TransformOptions<any>[]) {
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
        parsers[name] = createParser({
          base,
          parserFormat: name,
          opts,
        })

        return parsers[name]
      }
    }

    for (let [name, meta] of Object.entries(opts.printers ?? {})) {
      printers[name] = async () => {
        printers[name] = createPrinter({
          base,
          name,
          opts,
        })

        return printers[name]
      }
    }
  }

  return { parsers, printers }
}

function createParser({
  //
  base,
  parserFormat,
  opts,
}: {
  base: Base
  parserFormat: string
  opts: TransformOptions<any>
}) {
  let original = base.parsers[parserFormat]
  let parser: Parser<any> = { ...original }

  parser.preprocess = (code: string, options: ParserOptions) => {
    let original = base.originalParser(parserFormat, options)

    return original.preprocess ? original.preprocess(code, options) : code
  }

  parser.parse = async (code: string, options: ParserOptions) => {
    let original = base.originalParser(parserFormat, options)

    // @ts-ignore: We pass three options in the case of plugins that support Prettier 2 _and_ 3.
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
  //
  base,
  name,
  opts,
}: {
  base: Base
  name: string
  opts: TransformOptions<any>
}): Printer<any> {
  let original = base.printers[name]
  let printer = { ...original }
  let reprint = opts.reprint

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
