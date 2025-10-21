// @ts-ignore
import type {
  AttrDoubleQuoted,
  AttributeNode,
  AttrSingleQuoted,
  DocumentNode,
  HtmlElement,
  LiquidExpression,
  LiquidTag,
  TextNode,
} from '@shopify/prettier-plugin-liquid/dist/types.js'
import * as astTypes from 'ast-types'
// @ts-ignore
import jsesc from 'jsesc'
// @ts-ignore
import lineColumn from 'line-column'
import type { AstPath } from 'prettier'
import * as prettierParserAngular from 'prettier/plugins/angular'
import * as prettierParserBabel from 'prettier/plugins/babel'
// @ts-ignore
import * as recast from 'recast'
import { createPlugin, defineTransform } from './create-plugin.js'
import type { Matcher } from './options.js'
import { takenBranches } from './path.js'
import { loadPlugins } from './plugins.js'
import { sortClasses, sortClassList } from './sorting.js'
import type { StringChange, TransformerEnv } from './types'
import { spliceChangesIntoString, visit, type Path } from './utils.js'

let base = await loadPlugins()

const ESCAPE_SEQUENCE_PATTERN = /\\(['"\\nrtbfv0-7xuU])/g

function tryParseAngularAttribute(value: string, env: TransformerEnv) {
  let parsers = [
    // Try parsing as an angular directive
    prettierParserAngular.parsers.__ng_directive,

    // If this fails we fall back to arbitrary parsing of a JS expression
    { parse: env.parsers.__js_expression },
  ]

  let errors: unknown[] = []
  for (const parser of parsers) {
    try {
      return parser.parse(value, env.parsers, env.options)
    } catch (err) {
      errors.push(err)
    }
  }

  console.warn('prettier-plugin-tailwindcss: Unable to parse angular directive')
  errors.forEach((err) => console.warn(err))
}

function transformDynamicAngularAttribute(attr: any, env: TransformerEnv) {
  let directiveAst = tryParseAngularAttribute(attr.value, env)

  // If we've reached this point we couldn't parse the expression we we should bail
  // `tryParseAngularAttribute` will display some warnings/errors
  // But we shouldn't fail outright — just miss parsing some attributes
  if (!directiveAst) {
    return
  }

  let changes: StringChange[] = []

  visit(directiveAst, {
    StringLiteral(node, path) {
      if (!node.value) return

      let collapseWhitespace = canCollapseWhitespaceIn(path)

      changes.push({
        start: node.start + 1,
        end: node.end - 1,
        before: node.value,
        after: sortClasses(node.value, {
          env,
          collapseWhitespace,
        }),
      })
    },

    TemplateLiteral(node, path) {
      if (!node.quasis.length) return

      let collapseWhitespace = canCollapseWhitespaceIn(path)

      for (let i = 0; i < node.quasis.length; i++) {
        let quasi = node.quasis[i]

        changes.push({
          start: quasi.start,
          end: quasi.end,
          before: quasi.value.raw,
          after: sortClasses(quasi.value.raw, {
            env,

            // Is not the first "item" and does not start with a space
            ignoreFirst: i > 0 && !/^\s/.test(quasi.value.raw),

            // Is between two expressions
            // And does not end with a space
            ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.raw),

            collapseWhitespace: {
              start: collapseWhitespace.start && i === 0,
              end: collapseWhitespace.end && i >= node.expressions.length,
            },
          }),
        })
      }
    },
  })

  attr.value = spliceChangesIntoString(attr.value, changes)
}

function transformDynamicJsAttribute(attr: any, env: TransformerEnv) {
  let { matcher } = env

  let ast = recast.parse(`let __prettier_temp__ = ${attr.value}`, {
    parser: prettierParserBabel.parsers['babel-ts'],
  })

  function* ancestors<N, V>(path: import('ast-types/lib/node-path').NodePath<N, V>) {
    yield path

    while (path.parentPath) {
      path = path.parentPath
      yield path
    }
  }

  let didChange = false

  astTypes.visit(ast, {
    visitLiteral(path) {
      let entries = Array.from(ancestors(path))
      let concat = entries.find((entry) => {
        return (
          entry.parent &&
          entry.parent.value &&
          entry.parent.value.type === 'BinaryExpression' &&
          entry.parent.value.operator === '+'
        )
      })

      if (isStringLiteral(path.node)) {
        let sorted = sortStringLiteral(path.node, {
          env,
          collapseWhitespace: {
            start: concat?.name !== 'right',
            end: concat?.name !== 'left',
          },
        })

        if (sorted) {
          didChange = true

          // https://github.com/benjamn/recast/issues/171#issuecomment-224996336
          // @ts-ignore
          let quote = path.node.extra.raw[0]
          let value = jsesc(path.node.value, {
            quotes: quote === "'" ? 'single' : 'double',
          })
          // @ts-ignore
          path.node.value = new String(quote + value + quote)
        }
      }
      this.traverse(path)
    },

    visitTemplateLiteral(path) {
      let entries = Array.from(ancestors(path))
      let concat = entries.find((entry) => {
        return (
          entry.parent &&
          entry.parent.value &&
          entry.parent.value.type === 'BinaryExpression' &&
          entry.parent.value.operator === '+'
        )
      })

      let sorted = sortTemplateLiteral(path.node, {
        env,
        collapseWhitespace: {
          start: concat?.name !== 'right',
          end: concat?.name !== 'left',
        },
      })

      if (sorted) {
        didChange = true
      }

      this.traverse(path)
    },

    visitTaggedTemplateExpression(path) {
      let entries = Array.from(ancestors(path))
      let concat = entries.find((entry) => {
        return (
          entry.parent &&
          entry.parent.value &&
          entry.parent.value.type === 'BinaryExpression' &&
          entry.parent.value.operator === '+'
        )
      })

      if (isSortableTemplateExpression(path.node, matcher)) {
        let sorted = sortTemplateLiteral(path.node.quasi, {
          env,
          collapseWhitespace: {
            start: concat?.name !== 'right',
            end: concat?.name !== 'left',
          },
        })

        if (sorted) {
          didChange = true
        }
      }

      this.traverse(path)
    },
  })

  if (didChange) {
    attr.value = recast.print(ast.program.body[0].declarations[0].init).code
  }
}

function sortStringLiteral(
  node: any,
  {
    env,
    removeDuplicates,
    collapseWhitespace = { start: true, end: true },
  }: {
    env: TransformerEnv
    removeDuplicates?: false
    collapseWhitespace?: false | { start: boolean; end: boolean }
  },
) {
  let result = sortClasses(node.value, {
    env,
    removeDuplicates,
    collapseWhitespace,
  })

  let didChange = result !== node.value

  if (!didChange) return false

  node.value = result

  // Preserve the original escaping level for the new content
  let raw = node.extra?.raw ?? node.raw
  let quote = raw[0]
  let originalRawContent = raw.slice(1, -1)
  let originalValue = node.extra?.rawValue ?? node.value

  if (node.extra) {
    // The original list has ecapes so we ensure that the sorted list also
    // maintains those by replacing backslashes from escape sequences.
    //
    // It seems that TypeScript-based ASTs don't need this special handling
    // which is why this is guarded inside the `node.extra` check
    if (originalRawContent !== originalValue && originalValue.includes('\\')) {
      result = result.replace(ESCAPE_SEQUENCE_PATTERN, '\\\\$1')
    }

    // JavaScript (StringLiteral)
    node.extra = {
      ...node.extra,
      rawValue: result,
      raw: quote + result + quote,
    }
  } else {
    // TypeScript (Literal)
    node.raw = quote + result + quote
  }

  return true
}

function isStringLiteral(node: any) {
  return node.type === 'StringLiteral' || (node.type === 'Literal' && typeof node.value === 'string')
}

function sortTemplateLiteral(
  node: any,
  {
    env,
    removeDuplicates,
    collapseWhitespace = { start: true, end: true },
  }: {
    env: TransformerEnv
    removeDuplicates?: false
    collapseWhitespace?: false | { start: boolean; end: boolean }
  },
) {
  let didChange = false

  for (let i = 0; i < node.quasis.length; i++) {
    let quasi = node.quasis[i]
    let same = quasi.value.raw === quasi.value.cooked
    let originalRaw = quasi.value.raw
    let originalCooked = quasi.value.cooked

    quasi.value.raw = sortClasses(quasi.value.raw, {
      env,
      removeDuplicates,
      // Is not the first "item" and does not start with a space
      ignoreFirst: i > 0 && !/^\s/.test(quasi.value.raw),

      // Is between two expressions
      // And does not end with a space
      ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.raw),

      collapseWhitespace: collapseWhitespace && {
        start: collapseWhitespace && collapseWhitespace.start && i === 0,
        end: collapseWhitespace && collapseWhitespace.end && i >= node.expressions.length,
      },
    })

    quasi.value.cooked = same
      ? quasi.value.raw
      : sortClasses(quasi.value.cooked, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(quasi.value.cooked),
          ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.cooked),
          removeDuplicates,
          collapseWhitespace: collapseWhitespace && {
            start: collapseWhitespace && collapseWhitespace.start && i === 0,
            end: collapseWhitespace && collapseWhitespace.end && i >= node.expressions.length,
          },
        })

    if (quasi.value.raw !== originalRaw || quasi.value.cooked !== originalCooked) {
      didChange = true
    }
  }

  return didChange
}

function isSortableTemplateExpression(
  node: import('@babel/types').TaggedTemplateExpression | import('ast-types').namedTypes.TaggedTemplateExpression,
  matcher: Matcher,
): boolean {
  return isSortableExpression(node.tag, matcher)
}

function isSortableCallExpression(
  node: import('@babel/types').CallExpression | import('ast-types').namedTypes.CallExpression,
  matcher: Matcher,
): boolean {
  if (!node.arguments?.length) return false

  return isSortableExpression(node.callee, matcher)
}

function isSortableExpression(
  node:
    | import('@babel/types').Expression
    | import('@babel/types').V8IntrinsicIdentifier
    | import('ast-types').namedTypes.ASTNode,
  matcher: Matcher,
): boolean {
  // Traverse property accesses and function calls to find the leading ident
  while (node.type === 'CallExpression' || node.type === 'MemberExpression') {
    if (node.type === 'CallExpression') {
      node = node.callee
    } else if (node.type === 'MemberExpression') {
      node = node.object
    }
  }

  if (node.type === 'Identifier') {
    return matcher.hasFunction(node.name)
  }

  return false
}

function canCollapseWhitespaceIn(path: Path<import('@babel/types').Node, any>) {
  let start = true
  let end = true

  for (let entry of path) {
    if (!entry.parent) continue

    // Nodes inside concat expressions shouldn't collapse whitespace
    // depending on which side they're part of.
    if (entry.parent.type === 'BinaryExpression' && entry.parent.operator === '+') {
      start &&= entry.key !== 'right'
      end &&= entry.key !== 'left'
    }

    // This is probably expression *inside* of a template literal. To collapse whitespace
    // `Expression`s adjacent-before a quasi must start with whitespace
    // `Expression`s adjacent-after a quasi must end with whitespace
    //
    // Note this check will bail out on more than it really should as it
    // could be reset somewhere along the way by having whitespace around a
    // string further up but not at the "root" but that complicates things
    if (entry.parent.type === 'TemplateLiteral') {
      let nodeStart = entry.node.start ?? null
      let nodeEnd = entry.node.end ?? null

      for (let quasi of entry.parent.quasis) {
        let quasiStart = quasi.end ?? null
        let quasiEnd = quasi.end ?? null

        if (nodeStart !== null && quasiEnd !== null && nodeStart - quasiEnd <= 2) {
          start &&= /^\s/.test(quasi.value.raw)
        }

        if (nodeEnd !== null && quasiStart !== null && nodeEnd - quasiStart <= 2) {
          end &&= /\s$/.test(quasi.value.raw)
        }
      }
    }
  }

  return { start, end }
}

//
// Transforms for builtin plugins
//

type HtmlNode = { type: 'attribute'; name: string; value: string } | { kind: 'attribute'; name: string; value: string }
let html = defineTransform<HtmlNode>({
  // TODO: This plugin assigns its own parser
  // this means we have to import it and return its parser
  // Ideally Prettier could use our `html` printer and another plugins'
  // parser.
  //
  // For backwards compat maybe the printer has to be marked with a property
  // to enable this behavior?
  //
  // Also what if two plugins want to use printers to change behavior?
  // e.g.
  //
  // Plugin A has an `html` printer
  // Plugin B has an `html` printer
  //
  // and the *goal* of both is to run each of their passes on the AST nodes?
  //
  // Right now there's only one printer per AST format but that means other
  // plugins have to import earlier plugin's implementations which
  // means that there is now a direct dependency to the other plugin
  //
  // In an ideal world the plugins wouldn't need to know anything about
  // one another

  staticAttrs: ['class'],
  dynamicAttrs: [],

  parsers: {
    html: {
      load: ['prettier/plugins/html'],
      compatible: ['prettier-plugin-organize-attributes'],
    },
    lwc: {
      load: ['prettier/plugins/html'],
      compatible: ['prettier-plugin-organize-attributes'],
    },
    vue: {
      load: ['prettier/plugins/html'],
      compatible: ['prettier-plugin-organize-attributes'],
      dynamicAttrs: [':class', 'v-bind:class'],
    },
    angular: {
      load: ['prettier/plugins/html'],
      compatible: ['prettier-plugin-organize-attributes'],
      dynamicAttrs: ['[ngClass]'],
    },
  },

  printers: {
    html: { load: ['prettier/plugins/html'] },
  },

  reprint(path, { options, matcher, sort, env }) {
    let node = path.node

    // `type` is used in earlier versions of Prettier
    if ('type' in node && node.type !== 'attribute') return

    // `kind` is used in later versions of Prettier
    if ('kind' in node && node.kind !== 'attribute') return

    if (!('type' in node) && !('kind' in node)) return

    if (matcher.hasStaticAttr(node.name)) {
      node.value = sort(node.value)
    } else if (matcher.hasDynamicAttr(node.name)) {
      if (!/[`'"]/.test(node.value)) return

      if (options.parser === 'angular') {
        transformDynamicAngularAttribute(node, env)
      } else {
        transformDynamicJsAttribute(node, env)
      }

      // TODO
      // return { __force__: true } as any
    }
  },
})

type CssValueNode = { type: 'value-*'; name: string; params: string }
type CssNode = { type: 'css-atrule'; name: string; params: string | CssValueNode }

let css = defineTransform<CssNode>({
  parsers: {
    css: {
      load: ['prettier/plugins/postcss'],
      compatible: ['prettier-plugin-css-order'],
    },
    less: {
      load: ['prettier/plugins/postcss'],
      compatible: ['prettier-plugin-css-order'],
    },
    scss: {
      load: ['prettier/plugins/postcss'],
      compatible: ['prettier-plugin-css-order'],
    },
  },

  printers: {
    postcss: { load: ['prettier/plugins/postcss'] },
  },

  reprint(path, { options, sort }) {
    let node = path.node
    if (!node) return

    if (node.type !== 'css-atrule') return

    // Format the quotes used by `@plugin`, `@config`, and `@source`
    if (node.name === 'plugin' || node.name === 'config' || node.name === 'source') {
      // It might already be an object or array. Could happen in the future if
      // Prettier decides to start parsing these.
      if (typeof node.params !== 'string') return

      // Parse these nodes so Prettier will reformat the strings. Prettier has
      // a private API for this called parseValue() but we can't access it so
      // we have to produce the same result by parsing an import statement
      // with the same params
      try {
        // TODO: Can we use embeds here to reprint this node?

        let parser = base.parsers.css
        let root = parser.parse(`@import ${node.params};`, {
          // We can't pass options directly because css.parse overwrites
          // options.originalText which is used during the printing phase
          ...options,
        })

        node.params = root.nodes[0].params
      } catch {}
    }

    // Sort classes used in `@apply`
    if (node.name === 'apply') {
      if (typeof node.params !== 'string') return

      let isImportant = /\s+(?:!important|#{(['"]*)!important\1})\s*$/.test(node.params)

      let classes = node.params

      let prefix = ''
      let suffix = ''

      if (classes.startsWith('~"') && classes.endsWith('"')) {
        prefix = '~"'
        suffix = '"'
        classes = classes.slice(2, -1)
        isImportant = false
      } else if (classes.startsWith("~'") && classes.endsWith("'")) {
        prefix = "~'"
        suffix = "'"
        classes = classes.slice(2, -1)
        isImportant = false
      }

      classes = sort(classes, {
        ignoreFirst: false,
        ignoreLast: isImportant,
        collapseWhitespace: {
          start: false,
          end: !isImportant,
        },
      })

      node.params = `${prefix}${classes}${suffix}`
    }
  },
})

function canCollapseWhitespaceInBabel(path: AstPath<import('@babel/types').Node>) {
  let start = true
  let end = true

  for (let { node, parent, key } of takenBranches(path)) {
    if (!parent) continue

    // Nodes inside concat expressions shouldn't collapse whitespace
    // depending on which side they're part of.
    if (parent.node.type === 'BinaryExpression' && parent.node.operator === '+') {
      start &&= key !== 'right'
      end &&= key !== 'left'
    }

    // This is probably expression *inside* of a template literal. To collapse whitespace
    // `Expression`s adjacent-before a quasi must start with whitespace
    // `Expression`s adjacent-after a quasi must end with whitespace
    //
    // Note this check will bail out on more than it really should as it
    // could be reset somewhere along the way by having whitespace around a
    // string further up but not at the "root" but that complicates things
    if (parent.node.type === 'TemplateLiteral') {
      let nodeStart = node.start ?? null
      let nodeEnd = node.end ?? null

      for (let quasi of parent.node.quasis) {
        let quasiStart = quasi.end ?? null
        let quasiEnd = quasi.end ?? null

        if (nodeStart !== null && quasiEnd !== null && nodeStart - quasiEnd <= 2) {
          start &&= /^\s/.test(quasi.value.raw)
        }

        if (nodeEnd !== null && quasiStart !== null && nodeEnd - quasiStart <= 2) {
          end &&= /\s$/.test(quasi.value.raw)
        }
      }
    }
  }

  return { start, end }
}

let javascript = defineTransform<import('@babel/types').Node>({
  staticAttrs: ['class', 'className'],
  parsers: {
    babel: {
      load: ['prettier/plugins/babel'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    'babel-flow': {
      load: ['prettier/plugins/babel'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    'babel-ts': {
      load: ['prettier/plugins/babel'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    __js_expression: {
      load: ['prettier/plugins/babel'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    typescript: {
      load: ['prettier/plugins/typescript'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    meriyah: {
      load: ['prettier/plugins/meriyah'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    acorn: {
      load: ['prettier/plugins/acorn'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    flow: {
      load: ['prettier/plugins/flow'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    oxc: {
      load: ['@prettier/plugin-oxc'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    'oxc-ts': {
      load: ['@prettier/plugin-oxc'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },
    hermes: {
      load: ['@prettier/plugin-hermes'],
      compatible: [
        // The following plugins must come *before* the jsdoc plugin for it to
        // function correctly. Additionally `multiline-arrays` usually needs to be
        // placed before import sorting plugins.
        //
        // https://github.com/electrovir/prettier-plugin-multiline-arrays#compatibility
        'prettier-plugin-multiline-arrays',
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-organize-imports',
        'prettier-plugin-sort-imports',
        'prettier-plugin-jsdoc',
      ],
    },

    // TODO: This does not work but it would in an ideal world
    // __vue_ts_expression: {
    //   load: ['prettier/plugin/babel'],
    // },
    // __vue_expression: {
    //   load: ['prettier/plugin/babel'],
    // },
  },

  printers: {
    estree: { load: ['prettier/plugins/estree'] },
    'estree-oxc': { load: ['@prettier/plugin-oxc'] },
    'estree-hermes': { load: ['@prettier/plugin-hermes'] },
  },

  reprint(path, { matcher, env, options }) {
    let node = path.node

    // console.log({ what: options.__force__ })
    // let sortableAttr = '__force__' in options ? options.__force__ : false
    let sortableAttr = false
    let sortableFn = false

    for (let parent of path.ancestors) {
      if (parent.type === 'JSXAttribute') {
        // We don't want to support namespaced attributes (e.g. `someNs:class`)
        // React doesn't support them and most tools don't either
        if (typeof parent.name.name !== 'string') return

        sortableAttr ||= matcher.hasStaticAttr(parent.name.name)
      } else if (parent.type === 'CallExpression') {
        sortableFn ||= isSortableCallExpression(parent, matcher)
      } else if (parent.type === 'TaggedTemplateExpression') {
        sortableFn ||= isSortableTemplateExpression(parent, matcher)
      }
    }

    if (!sortableAttr && !sortableFn) return

    let collapseWhitespace = canCollapseWhitespaceInBabel(path)

    if (node.type === 'StringLiteral') {
      sortStringLiteral(node, { env, collapseWhitespace })
    } else if (node.type === 'TemplateLiteral') {
      sortTemplateLiteral(node, { env, collapseWhitespace })
    } else if (node.type === 'TaggedTemplateExpression') {
      if (!isSortableTemplateExpression(node, matcher)) return
      sortTemplateLiteral(node.quasi, { env, collapseWhitespace })
    }

    // @ts-ignore
    // The types don't cover this but this is for typescript
    else if (node.type === 'Literal' && typeof node.value === 'string') {
      sortStringLiteral(node, { env, collapseWhitespace })
    }
  },
})

type GlimmerNode =
  | { type: 'TextNode'; chars: string }
  | { type: 'StringLiteral'; value: string }
  | { type: 'ConcatStatement'; parts: GlimmerNode[] }
  | { type: 'SubExpression'; path: { original: string } }
  | { type: 'AttrNode'; name: string; value: GlimmerNode }

let glimmer = defineTransform<GlimmerNode>({
  staticAttrs: ['class'],

  parsers: {
    glimmer: { load: ['prettier/plugins/glimmer'] },
  },

  printers: {
    glimmer: { load: ['prettier/plugins/glimmer'] },
  },

  reprint(path, { matcher, sort }) {
    let node = path.node

    if (node.type !== 'TextNode' && node.type !== 'StringLiteral') return

    // Check to see if this is inside a sortable attribute
    let sortable = path.ancestors.some((node) => {
      return node.type === 'AttrNode' && matcher.hasStaticAttr(node.name)
    })

    if (!sortable) return

    if (node.type === 'TextNode') {
      let siblings = { prev: false, next: false }

      for (let { parent, index } of takenBranches(path)) {
        if (!parent) continue
        if (index === null) continue
        if (parent.node.type !== 'ConcatStatement') continue

        siblings.prev = parent.node.parts[index - 1] !== undefined
        siblings.next = parent.node.parts[index + 1] !== undefined
        break
      }

      node.chars = sort(node.chars, {
        ignoreFirst: siblings.prev && !/^\s/.test(node.chars),
        ignoreLast: siblings.next && !/\s$/.test(node.chars),
        collapseWhitespace: {
          start: !siblings.prev,
          end: !siblings.next,
        },
      })
    }

    if (node.type === 'StringLiteral') {
      let concat = takenBranches(path).some(({ parent }) => {
        return parent && parent.node.type === 'SubExpression' && parent.node.path.original === 'concat'
      })

      node.value = sort(node.value, {
        ignoreLast: concat && !/[^\S\r\n]$/.test(node.value),
        collapseWhitespace: {
          start: false,
          end: !concat,
        },
      })
    }
  },
})

type AstroNode =
  | { type: 'element'; attributes: Extract<AstroNode, { type: 'attribute' }>[] }
  | { type: 'custom-element'; attributes: Extract<AstroNode, { type: 'attribute' }>[] }
  | { type: 'component'; attributes: Extract<AstroNode, { type: 'attribute' }>[] }
  | { type: 'attribute'; kind: 'quoted'; name: string; value: string }
  | { type: 'attribute'; kind: 'expression'; name: string; value: unknown }

let astro = defineTransform<AstroNode>({
  staticAttrs: ['class', 'className'],
  dynamicAttrs: ['class:list', 'className'],

  parsers: {
    astro: { load: ['prettier-plugin-astro'] },
  },

  printers: {
    astro: { load: ['prettier-plugin-astro'] },
  },

  reprint(path, { matcher, sort, env }) {
    let node = path.node

    if (node.type !== 'attribute') return

    if (node.kind === 'quoted') {
      if (!matcher.hasStaticAttr(node.name)) return

      node.value = sort(node.value)
    }

    if (node.kind === 'expression') {
      if (typeof node.value !== 'string') return
      if (!matcher.hasDynamicAttr(node.name)) return

      transformDynamicJsAttribute(node, env)
    }
  },
})

type LiquidNode = TextNode | AttributeNode | LiquidTag | HtmlElement | DocumentNode | LiquidExpression

let liquid = defineTransform<LiquidNode>({
  staticAttrs: ['class'],

  parsers: {
    'liquid-html': { load: ['@shopify/prettier-plugin-liquid'] },
  },

  printers: {
    'liquid-html-ast': { load: ['@shopify/prettier-plugin-liquid'] },
  },

  reprint(path, { matcher, sort }) {
    let node = path.node

    // We only need to sort text nodes and strings inside expressions
    if (node.type !== 'TextNode' && node.type !== 'String') return

    // Make note of where we are in the tree
    let sources: LiquidNode[] = []
    let attr: AttrSingleQuoted | AttrDoubleQuoted | null = null
    let index: number | null = 0

    for (let i = 0; i < path.ancestors.length; ++i) {
      let parent = path.ancestors[i]
      if (parent.type === 'LiquidTag') {
        sources.push(parent)
      } else if (parent.type === 'AttrSingleQuoted' || parent.type === 'AttrDoubleQuoted') {
        sources.push(parent)

        for (let node of parent.name) {
          // The node name can't contain an expression
          // TODO: Maybe we should allow this when using regexes?
          // But what should the "name" match against in that case?
          if (node.type !== 'TextNode') return

          // And this specific attribute must be sortable
          if (!matcher.hasStaticAttr(node.value)) return
        }

        // The *closest* attribute is the one we care about
        if (attr) continue

        attr = parent
        index = path.callParent((p) => p.index, i - 1) ?? 0
      }
    }

    // We always have to be inside a sortable attribute
    if (!attr) return

    let after = sort(node.value, {
      ignoreFirst: index > 0 && !/^\s/.test(node.value),
      ignoreLast: index < attr.value.length - 1 && !/\s$/.test(node.value),

      // We can't change the length of the string since the plugin slices a string when printing
      // This means source locations cannot change under any circumstances

      // IDEA:
      //
      // - To remove duplicates we should replace the duplicates with equal length whitespace
      // - To collapse whitespace = shuffle all classes to the front and pad the end with whitespace
      //   so the string does not change length
      //
      // We should encode the length immutability as an option to the sort() helper so it can
      // handle these cases directly.
      removeDuplicates: false,
      collapseWhitespace: false,
    })

    let change: StringChange = {
      start: node.position.start,
      end: node.position.end,
      before: node.value,
      after,
    }

    // Inset the position as the node position includes quotes but the value never does
    if (node.type === 'String') {
      let str = node.source.slice(change.start, change.end)
      let start = str[0]
      let end = str[str.length - 1]

      if (start === end && (start === '"' || start === "'" || start === '`')) {
        change.start += 1
        change.end -= 1
      }
    }

    // The Liquid plugin uses the `source` property on nodes when printing:
    // 1. Attribute values use the one on the attribute node
    // 2. Liquid tags use the one on the tag node
    for (let parent of sources) {
      parent.source = spliceChangesIntoString(parent.source, [change])
    }
  },
})

interface PugNode {
  content: string
  tokens: import('pug-lexer').Token[]
}

let pug = defineTransform<PugNode>({
  staticAttrs: ['class'],

  parsers: {
    pug: { load: ['@prettier/plugin-pug'] },
  },

  printers: {
    'pug-ast': { load: ['@prettier/plugin-pug'] },
  },

  reprint(path, { matcher, env, sort }) {
    let ast = path.node

    // This isn't optimal
    // We should merge the classes together across class attributes and class tokens
    // And then we sort them
    // But this is good enough for now

    // First sort the classes in attributes
    for (let token of ast.tokens) {
      if (token.type !== 'attribute') continue
      if (typeof token.val === 'boolean') continue
      if (!matcher.hasStaticAttr(token.name)) continue

      token.val = token.val.slice(0, 1) + sort(token.val.slice(1, -1)) + token.val.slice(-1)
    }

    // Collect lists of consecutive class tokens
    let startIdx = -1
    let endIdx = -1
    let ranges: [number, number][] = []

    for (let i = 0; i < ast.tokens.length; i++) {
      let token = ast.tokens[i]

      if (token.type === 'class') {
        startIdx = startIdx === -1 ? i : startIdx
        endIdx = i
      } else if (startIdx !== -1) {
        ranges.push([startIdx, endIdx])
        startIdx = -1
        endIdx = -1
      }
    }

    if (startIdx !== -1) {
      ranges.push([startIdx, endIdx])
      startIdx = -1
      endIdx = -1
    }

    // Sort the lists of class tokens
    for (let [startIdx, endIdx] of ranges) {
      let classes = ast.tokens.slice(startIdx, endIdx + 1).map((token: any) => token.val)

      let { classList } = sortClassList(classes, {
        env,
        removeDuplicates: false,
      })

      for (let i = startIdx; i <= endIdx; i++) {
        let token = ast.tokens[i]
        if (token.type !== 'class') continue
        token.val = classList[i - startIdx]
      }
    }
  },
})

type MarkoNode = import('@marko/compiler').types.Node

let marko = defineTransform<MarkoNode>({
  staticAttrs: ['class'],

  parsers: {
    marko: { load: ['prettier-plugin-marko'] },
  },

  printers: {
    'marko-ast': { load: ['prettier-plugin-marko'] },
  },

  reprint(path, { matcher, sort }) {
    let node = path.node

    if (node.type !== 'StringLiteral') return

    let sortable = false
    for (let parent of path.ancestors) {
      // TODO: We should handle concat expressions
      if (parent.type === 'BinaryExpression') return

      if (parent.type !== 'MarkoAttribute') continue
      if (!matcher.hasStaticAttr(parent.name)) continue

      sortable = true
    }

    if (!sortable) return

    node.value = sort(node.value)
  },
})

type SvelteNode = import('svelte/compiler').AST.SvelteNode

let svelte = defineTransform<SvelteNode>({
  staticAttrs: ['class'],

  parsers: {
    svelte: { load: ['prettier-plugin-svelte'] },
  },

  printers: {
    'svelte-ast': { load: ['prettier-plugin-svelte'] },
  },

  reprint(path, { matcher, sort, env, options }) {
    let node = path.node

    function sortableAttribute() {
      for (let i = 0; i < path.ancestors.length; ++i) {
        let node = path.ancestors[i]
        if (node.type !== 'Attribute') continue
        if (!matcher.hasStaticAttr(node.name)) return { attr: null, index: 0 }

        return {
          attr: node,
          value: node.value,
          index: path.callParent((p) => p.index, i - 1) ?? 0,
        }
      }

      return { attr: null, index: 0 }
    }

    function applyChanges(text: string, callback: (finder: any) => StringChange[]): string {
      return spliceChangesIntoString(text, callback(lineColumn(text)))
    }

    if (node.type === 'Text') {
      let { attr, index } = sortableAttribute()
      if (!attr) return
      if (typeof attr.value === 'boolean') return

      // TODO?
      if (!Array.isArray(attr.value)) return

      let same = node.raw === node.data

      node.raw = sort(node.raw, {
        ignoreFirst: index > 0 && !/^\s/.test(node.raw),
        ignoreLast: index < attr.value.length - 1 && !/\s$/.test(node.raw),
        removeDuplicates: true,
        collapseWhitespace: false,
      })

      node.data = same
        ? node.raw
        : sort(node.data, {
            ignoreFirst: index > 0 && !/^\s/.test(node.data),
            ignoreLast: index < attr.value.length - 1 && !/\s$/.test(node.data),
            removeDuplicates: true,
            collapseWhitespace: false,
          })
    }

    if (node.type === 'Literal') {
      let { attr, index } = sortableAttribute()
      if (!attr) return
      if (!isStringLiteral(node)) return
      if (!node.raw) return
      if (!node.loc) return

      let before = node.raw

      let sorted = sortStringLiteral(node, {
        env,
        removeDuplicates: false,
        collapseWhitespace: false,
      })

      if (!sorted) return

      options.originalText = applyChanges(options.originalText, (finder) => {
        if (!node.loc) return []
        if (!node.raw) return []

        let start = finder.toIndex(node.loc.start.line, node.loc.start.column + 1)
        let end = finder.toIndex(node.loc.end.line, node.loc.end.column + 1)

        return [{ before, after: node.raw, start, end }]
      })
    }

    if (node.type === 'TemplateLiteral') {
      let { attr, index } = sortableAttribute()
      if (!attr) return

      let before = node.quasis.map((quasi: any) => quasi.value.raw)
      let sorted = sortTemplateLiteral(node, {
        env,
        removeDuplicates: false,
        collapseWhitespace: false,
      })

      if (!sorted) return

      options.originalText = applyChanges(options.originalText, (finder) => {
        let changes: StringChange[] = []

        for (let [idx, quasi] of node.quasis.entries()) {
          if (!quasi.loc) continue

          let start = finder.toIndex(quasi.loc.start.line, quasi.loc.start.column + 1)
          let end = finder.toIndex(quasi.loc.end.line, quasi.loc.end.column + 1)

          changes.push({
            before: before[idx],
            after: quasi.value.raw,
            start,
            end,
          })
        }

        return changes
      })
    }
  },
})

type TwigIdentifier = { type: 'Identifier'; name: string }

type TwigMemberExpression = {
  type: 'MemberExpression'
  property: TwigIdentifier | TwigCallExpression | TwigMemberExpression
}

type TwigCallExpression = {
  type: 'CallExpression'
  callee: TwigIdentifier | TwigCallExpression | TwigMemberExpression
}

type TwigNode =
  | { type: 'Attribute'; name: TwigIdentifier }
  | { type: 'StringLiteral'; value: string }
  | { type: 'BinaryConcatExpression' }
  | { type: 'BinaryAddExpression' }
  | TwigIdentifier
  | TwigMemberExpression
  | TwigCallExpression

let twig = defineTransform<TwigNode>({
  staticAttrs: ['class'],

  parsers: {
    twig: { load: ['@zackad/prettier-plugin-twig'] },
  },

  printers: {
    twig: { load: ['@zackad/prettier-plugin-twig'] },
  },

  reprint(path, { matcher, sort }) {
    let node = path.node

    if (node.type !== 'StringLiteral') return

    // We must be in a sortable attribute *or* a sortable fn call
    let sortableAttr = false
    let sortableFn = false

    for (let parent of path.ancestors) {
      if (parent.type === 'Attribute') {
        sortableAttr ||= matcher.hasStaticAttr(parent.name.name)
      } else if (parent.type === 'CallExpression') {
        while (parent.type === 'CallExpression' || parent.type === 'MemberExpression') {
          if (parent.type === 'CallExpression') {
            parent = parent.callee
          } else if (parent.type === 'MemberExpression') {
            // TODO: This is *different* than `isSortableExpression` and that doesn't feel right
            // but they're mutually exclusive implementations
            //
            // This is to handle foo.fnNameHere(…) where `isSortableExpression` is intentionally
            // handling `fnNameHere.foo(…)`.
            parent = parent.property
          }
        }

        sortableFn ||= parent.type === 'Identifier' && matcher.hasFunction(parent.name)
      }
    }

    if (!sortableAttr && !sortableFn) return

    let concat = takenBranches(path).find(({ parent }) => {
      return parent && (parent.node.type === 'BinaryConcatExpression' || parent.node.type === 'BinaryAddExpression')
    })

    node.value = sort(node.value, {
      ignoreFirst: concat?.key === 'right' && !/^[^\S\r\n]/.test(node.value),
      ignoreLast: concat?.key === 'left' && !/[^\S\r\n]$/.test(node.value),
      collapseWhitespace: {
        start: concat?.key !== 'right',
        end: concat?.key !== 'left',
      },
    })
  },
})

let { parsers, printers } = createPlugin([
  //
  html,
  css,
  javascript,
  glimmer,
  astro,
  liquid,
  pug,
  marko,
  svelte,
  twig,
])

export { parsers, printers }
export { options } from './options.js'

export interface PluginOptions {
  /**
   * Path to the Tailwind config file.
   */
  tailwindConfig?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+)
   */
  tailwindStylesheet?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+)
   *
   * @deprecated Use `tailwindStylesheet` instead
   */
  tailwindEntryPoint?: string

  /**
   * List of custom function and tag names that contain classes.
   */
  tailwindFunctions?: string[]

  /**
   * List of custom attributes that contain classes.
   */
  tailwindAttributes?: string[]

  /**
   * Preserve whitespace around Tailwind classes when sorting.
   */
  tailwindPreserveWhitespace?: boolean

  /**
   * Preserve duplicate classes inside a class list when sorting.
   */
  tailwindPreserveDuplicates?: boolean
}
