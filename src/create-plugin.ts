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
      parsers[name] = createParser(base, name, opts.transform, {
        staticAttrs: meta.staticAttrs ?? [],
        dynamicAttrs: meta.dynamicAttrs ?? [],
      })
    }
  }

  return { parsers }
}

function createParser(
  base: Base,
  parserFormat: string,
  transform: (ast: any, env: TransformerEnv) => void,
  meta: TransformerMetadata = {},
) {
  let customizationDefaults: Customizations = {
    staticAttrs: new Set(meta.staticAttrs ?? []),
    dynamicAttrs: new Set(meta.dynamicAttrs ?? []),
    functions: new Set(meta.functions ?? []),
    staticAttrsRegex: [],
    dynamicAttrsRegex: [],
    functionsRegex: [],
  }

  return {
    ...base.parsers[parserFormat],

    preprocess(code: string, options: ParserOptions) {
      let original = base.originalParser(parserFormat, options)

      return original.preprocess ? original.preprocess(code, options) : code
    },

    async parse(text: string, options: ParserOptions) {
      let context = await getTailwindConfig(options)

      let original = base.originalParser(parserFormat, options)

      // @ts-ignore: We pass three options in the case of plugins that support Prettier 2 _and_ 3.
      let ast = await original.parse(text, options, options)

      let matcher = createMatcher(options, parserFormat, customizationDefaults)

      let env: TransformerEnv = {
        context,
        matcher,
        options,
        changes: [],
      }

      transform(ast, env)

      if (parserFormat === 'svelte') {
        ast.changes = env.changes
      }

      return ast
    },
  }
}
