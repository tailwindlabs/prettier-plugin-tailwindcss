import type { Parser, ParserOptions } from 'prettier'
import { getTailwindConfig } from './config'
import { createMatcher } from './options'
import type { loadPlugins } from './plugins'
import type { TransformOptions } from './transform'
import type { Customizations, TransformerEnv, TransformerMetadata } from './types'

type Base = Awaited<ReturnType<typeof loadPlugins>>

export function createPlugin(base: Base, transforms: TransformOptions<any>[]) {
  let parsers: Record<string, Parser<any>> = Object.create(null)

  for (let opts of transforms) {
    for (let [name, meta] of Object.entries(opts.parsers)) {
      parsers[name] = createParser({
        base,
        parserFormat: name,
        opts,
      })
    }
  }

  return { parsers }
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
  return {
    ...base.parsers[parserFormat],

    preprocess(code: string, options: ParserOptions) {
      let original = base.originalParser(parserFormat, options)

      return original.preprocess ? original.preprocess(code, options) : code
    },

    async parse(text: string, options: ParserOptions) {
      let original = base.originalParser(parserFormat, options)

      // @ts-ignore: We pass three options in the case of plugins that support Prettier 2 _and_ 3.
      let ast = await original.parse(text, options, options)

      let env = await loadTailwindCSS({ opts, options })

      transformAst({
        ast,
        env,
        opts,
        options,
      })

      return ast
    },
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
    staticAttrs: new Set(parsers[parser]?.staticAttrs ?? []),
    dynamicAttrs: new Set(parsers[parser]?.dynamicAttrs ?? []),
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
  options,
  env,
  opts,
}: {
  ast: T
  env: TransformerEnv
  options: ParserOptions<T>
  opts: TransformOptions<T>
}) {
  let transform = opts.transform
  if (transform) {
    transform(ast, env)
  }

  if (options.parser === 'svelte') {
    // @ts-ignore
    ast.changes = env.changes
  }
}
