// @ts-check
import * as astTypes from 'ast-types'
import jsesc from 'jsesc'
import lineColumn from 'line-column'
import prettierParserAngular from 'prettier/parser-angular'
import prettierParserBabel from 'prettier/parser-babel'
import prettierParserEspree from 'prettier/parser-espree'
import prettierParserFlow from 'prettier/parser-flow'
import prettierParserGlimmer from 'prettier/parser-glimmer'
import prettierParserHTML from 'prettier/parser-html'
import prettierParserMeriyah from 'prettier/parser-meriyah'
import prettierParserPostCSS from 'prettier/parser-postcss'
import prettierParserTypescript from 'prettier/parser-typescript'
import * as recast from 'recast'
import {
  getCompatibleParser,
  getAdditionalParsers,
  getAdditionalPrinters,
} from './compat.js'
import { getTailwindConfig } from './config-v2.js'
import { getCustomizations } from './options.js'
import { sortClasses, sortClassList } from './sorting.js'
import { visit } from './utils.js'

let base = getBasePlugins()

/** @typedef {import('./types').Customizations} Customizations */
/** @typedef {import('./types').TransformerContext} TransformerContext */
/** @typedef {import('./types').TransformerMetadata} TransformerMetadata */

/**
 * @param {string} parserFormat
 * @param {(ast: any, context: TransformerContext) => void} transform
 * @param {TransformerMetadata} meta
 */
function createParser(parserFormat, transform, meta = {}) {
  /** @type {Customizations} */
  let customizationDefaults = {
    staticAttrs: new Set(meta.staticAttrs ?? []),
    dynamicAttrs: new Set(meta.dynamicAttrs ?? []),
    functions: new Set(meta.functions ?? []),
  }

  return {
    ...base.parsers[parserFormat],
    preprocess(code, options) {
      let original = getCompatibleParser(base, parserFormat, options)

      return original.preprocess ? original.preprocess(code, options) : code
    },

    /**
     *
     * @param {string} text
     * @param {any} parsers
     * @param {import('prettier').ParserOptions} options
     * @returns
     */
    parse(text, parsers, options = {}) {
      let { context, generateRules } = getTailwindConfig(options)

      let original = getCompatibleParser(base, parserFormat, options)

      if (original.astFormat in printers) {
        options.printer = printers[original.astFormat]
      }

      let ast = original.parse(text, parsers, options)

      let customizations = getCustomizations(
        options,
        parserFormat,
        customizationDefaults,
      )

      let changes = []

      transform(ast, {
        env: { context, customizations, generateRules, parsers, options },
        changes,
      })

      if (parserFormat === 'svelte') {
        ast.changes = changes
      }

      return ast
    },
  }
}

function tryParseAngularAttribute(value, env) {
  let parsers = [
    // Try parsing as an angular directive
    prettierParserAngular.parsers.__ng_directive,

    // If this fails we fall back to arbitrary parsing of a JS expression
    { parse: env.parsers.__js_expression },
  ]

  let errors = []
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

function transformDynamicAngularAttribute(attr, env) {
  let directiveAst = tryParseAngularAttribute(attr.value, env)

  // If we've reached this point we couldn't parse the expression we we should bail
  // `tryParseAngularAttribute` will display some warnings/errors
  // But we shouldn't fail outright — just miss parsing some attributes
  if (!directiveAst) {
    return
  }

  visit(directiveAst, {
    StringLiteral(node) {
      if (!node.value) return
      attr.value =
        attr.value.slice(0, node.start + 1) +
        sortClasses(node.value, { env }) +
        attr.value.slice(node.end - 1)
    },
  })
}

function transformDynamicJsAttribute(attr, env) {
  let { functions } = env.customizations

  let ast = recast.parse(`let __prettier_temp__ = ${attr.value}`, {
    parser: prettierParserBabel.parsers['babel-ts'],
  })

  let didChange = false

  astTypes.visit(ast, {
    visitLiteral(path) {
      if (isStringLiteral(path.node)) {
        if (sortStringLiteral(path.node, { env })) {
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
      if (sortTemplateLiteral(path.node, { env })) {
        didChange = true
      }
      this.traverse(path)
    },

    visitTaggedTemplateExpression(path) {
      if (isSortableTemplateExpression(path.node, functions)) {
        if (sortTemplateLiteral(path.node.quasi, { env })) {
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

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformHtml(ast, { env, changes }) {
  let { staticAttrs, dynamicAttrs } = env.customizations
  let { parser } = env.options

  for (let attr of ast.attrs ?? []) {
    if (staticAttrs.has(attr.name)) {
      attr.value = sortClasses(attr.value, { env })
    } else if (dynamicAttrs.has(attr.name)) {
      if (!/[`'"]/.test(attr.value)) {
        continue
      }

      if (parser === 'angular') {
        transformDynamicAngularAttribute(attr, env)
      } else {
        transformDynamicJsAttribute(attr, env)
      }
    }
  }

  for (let child of ast.children ?? []) {
    transformHtml(child, { env, changes })
  }
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformGlimmer(ast, { env }) {
  let { staticAttrs } = env.customizations

  visit(ast, {
    AttrNode(attr, parent, key, index, meta) {
      if (staticAttrs.has(attr.name) && attr.value) {
        meta.sortTextNodes = true
      }
    },

    TextNode(node, parent, key, index, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      let siblings =
        parent?.type === 'ConcatStatement'
          ? {
              prev: parent.parts[index - 1],
              next: parent.parts[index + 1],
            }
          : null

      node.chars = sortClasses(node.chars, {
        env,
        ignoreFirst: siblings?.prev && !/^\s/.test(node.chars),
        ignoreLast: siblings?.next && !/\s$/.test(node.chars),
      })
    },

    StringLiteral(node, parent, key, index, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      const isConcat =
        parent.type === 'SubExpression' && parent.path.original === 'concat'

      node.value = sortClasses(node.value, {
        env,
        ignoreLast: isConcat && !/[^\S\r\n]$/.test(node.value),
      })
    },
  })
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformLiquid(ast, { env }) {
  let { staticAttrs } = env.customizations

  /** @param {{name: string | {type: string, value: string}[]}} node */
  function isClassAttr(node) {
    return Array.isArray(node.name)
      ? node.name.every(
          (n) => n.type === 'TextNode' && staticAttrs.has(n.value),
        )
      : staticAttrs.has(node.name)
  }

  /**
   * @param {string} str
   */
  function hasSurroundingQuotes(str) {
    let start = str[0]
    let end = str[str.length - 1]

    return start === end && (start === '"' || start === "'" || start === '`')
  }

  /** @type {{type: string, source: string}[]} */
  let sources = []

  /** @type {{pos: {start: number, end: number}, value: string}[]} */
  let changes = []

  /** @typedef {import('@shopify/prettier-plugin-liquid/dist/types.js').AttrSingleQuoted} AttrSingleQuoted */
  /** @typedef {import('@shopify/prettier-plugin-liquid/dist/types.js').AttrDoubleQuoted} AttrDoubleQuoted */

  /**
   * @param {AttrSingleQuoted | AttrDoubleQuoted} attr
   */
  function sortAttribute(attr) {
    for (let i = 0; i < attr.value.length; i++) {
      let node = attr.value[i]
      if (node.type === 'TextNode') {
        node.value = sortClasses(node.value, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(node.value),
          ignoreLast: i < attr.value.length - 1 && !/\s$/.test(node.value),
        })

        changes.push({
          pos: node.position,
          value: node.value,
        })
      } else if (
        node.type === 'LiquidDrop' &&
        typeof node.markup === 'object' &&
        node.markup.type === 'LiquidVariable'
      ) {
        visit(node.markup.expression, {
          String(node) {
            let pos = { ...node.position }

            // We have to offset the position ONLY when quotes are part of the String node
            // This is because `value` does NOT include quotes
            if (hasSurroundingQuotes(node.source.slice(pos.start, pos.end))) {
              pos.start += 1
              pos.end -= 1
            }

            node.value = sortClasses(node.value, { env })

            changes.push({
              pos,
              value: node.value,
            })
          },
        })
      }
    }
  }

  visit(ast, {
    LiquidTag(node) {
      sources.push(node)
    },

    HtmlElement(node) {
      sources.push(node)
    },

    AttrSingleQuoted(node) {
      if (isClassAttr(node)) {
        sources.push(node)
        sortAttribute(node)
      }
    },

    AttrDoubleQuoted(node) {
      if (isClassAttr(node)) {
        sources.push(node)
        sortAttribute(node)
      }
    },
  })

  // Sort so all changes occur in order
  changes = changes.sort((a, b) => {
    return a.pos.start - b.pos.start || a.pos.end - b.pos.end
  })

  for (let change of changes) {
    for (let node of sources) {
      node.source =
        node.source.slice(0, change.pos.start) +
        change.value +
        node.source.slice(change.pos.end)
    }
  }
}

function sortStringLiteral(node, { env }) {
  let result = sortClasses(node.value, { env })
  let didChange = result !== node.value
  node.value = result
  if (node.extra) {
    // JavaScript (StringLiteral)
    let raw = node.extra.raw
    node.extra = {
      ...node.extra,
      rawValue: result,
      raw: raw[0] + result + raw.slice(-1),
    }
  } else {
    // TypeScript (Literal)
    let raw = node.raw
    node.raw = raw[0] + result + raw.slice(-1)
  }
  return didChange
}

function isStringLiteral(node) {
  return (
    node.type === 'StringLiteral' ||
    (node.type === 'Literal' && typeof node.value === 'string')
  )
}

function sortTemplateLiteral(node, { env }) {
  let didChange = false

  for (let i = 0; i < node.quasis.length; i++) {
    let quasi = node.quasis[i]
    let same = quasi.value.raw === quasi.value.cooked
    let originalRaw = quasi.value.raw
    let originalCooked = quasi.value.cooked

    quasi.value.raw = sortClasses(quasi.value.raw, {
      env,
      ignoreFirst: i > 0 && !/^\s/.test(quasi.value.raw),
      ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.raw),
    })

    quasi.value.cooked = same
      ? quasi.value.raw
      : sortClasses(quasi.value.cooked, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(quasi.value.cooked),
          ignoreLast:
            i < node.expressions.length && !/\s$/.test(quasi.value.cooked),
        })

    if (
      quasi.value.raw !== originalRaw ||
      quasi.value.cooked !== originalCooked
    ) {
      didChange = true
    }
  }

  return didChange
}

/**
 *
 * @param {import('@babel/types').TaggedTemplateExpression | import('ast-types').namedTypes.TaggedTemplateExpression} node
 * @param {Set<string>} functions
 * @returns {boolean}
 */
function isSortableTemplateExpression(node, functions) {
  if (node.tag.type === 'Identifier') {
    return functions.has(node.tag.name)
  }

  if (node.tag.type === 'MemberExpression') {
    let expr = node.tag.object

    // If the tag is a MemberExpression we should traverse all MemberExpression's until we find the leading Identifier
    while (expr.type === 'MemberExpression') {
      expr = expr.object
    }

    if (expr.type === 'Identifier') {
      return functions.has(expr.name)
    }
  }

  return false
}

/**
 * @param {import('@babel/types').Node} ast
 * @param {TransformerContext} param1
 */
function transformJavaScript(ast, { env }) {
  let { staticAttrs, functions } = env.customizations

  /** @param {import('@babel/types').Node} ast */
  function sortInside(ast) {
    visit(ast, (node) => {
      if (isStringLiteral(node)) {
        sortStringLiteral(node, { env })
      } else if (node.type === 'TemplateLiteral') {
        sortTemplateLiteral(node, { env })
      } else if (node.type === 'TaggedTemplateExpression') {
        if (isSortableTemplateExpression(node, functions)) {
          sortTemplateLiteral(node.quasi, { env })
        }
      }
    })
  }

  visit(ast, {
    /** @param {import('@babel/types').JSXAttribute} node */
    JSXAttribute(node) {
      if (!node.value) {
        return
      }

      if (!staticAttrs.has(node.name.name)) {
        return
      }

      if (isStringLiteral(node.value)) {
        sortStringLiteral(node.value, { env })
      } else if (node.value.type === 'JSXExpressionContainer') {
        sortInside(node.value)
      }
    },

    /** @param {import('@babel/types').CallExpression} node */
    CallExpression(node) {
      if (!node.arguments?.length) {
        return
      }

      if (!functions.has(node.callee?.name ?? '')) {
        return
      }

      node.arguments.forEach((arg) => sortInside(arg))
    },

    /** @param {import('@babel/types').TaggedTemplateExpression} node */
    TaggedTemplateExpression(node) {
      if (!isSortableTemplateExpression(node, functions)) {
        return
      }

      sortTemplateLiteral(node.quasi, { env })
    },
  })
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformCss(ast, { env }) {
  ast.walk((node) => {
    if (node.type === 'css-atrule' && node.name === 'apply') {
      node.params = sortClasses(node.params, {
        env,
        ignoreLast: /\s+(?:!important|#{!important})\s*$/.test(node.params),
      })
    }
  })
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformAstro(ast, { env, changes }) {
  let { staticAttrs } = env.customizations

  if (
    ast.type === 'element' ||
    ast.type === 'custom-element' ||
    ast.type === 'component'
  ) {
    for (let attr of ast.attributes ?? []) {
      if (
        staticAttrs.has(attr.name) &&
        attr.type === 'attribute' &&
        attr.kind === 'quoted'
      ) {
        attr.value = sortClasses(attr.value, {
          env,
        })
      }
    }
  }

  for (let child of ast.children ?? []) {
    transformAstro(child, { env, changes })
  }
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformMarko(ast, { env }) {
  let { staticAttrs } = env.customizations

  const nodesToVisit = [ast]
  while (nodesToVisit.length > 0) {
    const currentNode = nodesToVisit.pop()
    switch (currentNode.type) {
      case 'File':
        nodesToVisit.push(currentNode.program)
        break
      case 'Program':
        nodesToVisit.push(...currentNode.body)
        break
      case 'MarkoTag':
        nodesToVisit.push(...currentNode.attributes)
        nodesToVisit.push(currentNode.body)
        break
      case 'MarkoTagBody':
        nodesToVisit.push(...currentNode.body)
        break
      case 'MarkoAttribute':
        if (!staticAttrs.has(currentNode.name)) break
        switch (currentNode.value.type) {
          case 'ArrayExpression':
            const classList = currentNode.value.elements
            for (const node of classList) {
              if (node.type === 'StringLiteral') {
                node.value = sortClasses(node.value, { env })
              }
            }
            break
          case 'StringLiteral':
            currentNode.value.value = sortClasses(currentNode.value.value, {
              env,
            })
            break
        }
        break
    }
  }
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformMelody(ast, { env, changes }) {
  let { staticAttrs } = env.customizations

  for (let child of ast.expressions ?? []) {
    transformMelody(child, { env, changes })
  }

  visit(ast, {
    Attribute(node, _parent, _key, _index, meta) {
      if (!staticAttrs.has(node.name.name)) return

      meta.sortTextNodes = true
    },

    StringLiteral(node, parent, _key, _index, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      const isConcat = parent.type === 'BinaryConcatExpression'

      node.value = sortClasses(node.value, {
        env,
        ignoreFirst:
          isConcat && _key === 'right' && !/^[^\S\r\n]/.test(node.value),
        ignoreLast:
          isConcat && _key === 'left' && !/[^\S\r\n]$/.test(node.value),
      })
    },
  })
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformPug(ast, { env }) {
  let { staticAttrs } = env.customizations

  // This isn't optimal
  // We should merge the classes together across class attributes and class tokens
  // And then we sort them
  // But this is good enough for now

  // First sort the classes in attributes
  for (const token of ast.tokens) {
    if (token.type === 'attribute' && staticAttrs.has(token.name)) {
      token.val = [
        token.val.slice(0, 1),
        sortClasses(token.val.slice(1, -1), { env }),
        token.val.slice(-1),
      ].join('')
    }
  }

  // Collect lists of consecutive class tokens
  let startIdx = -1
  let endIdx = -1
  let ranges = []

  for (let i = 0; i < ast.tokens.length; i++) {
    const token = ast.tokens[i]

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
  for (const [startIdx, endIdx] of ranges) {
    const classes = ast.tokens
      .slice(startIdx, endIdx + 1)
      .map((token) => token.val)
    const classList = sortClassList(classes, { env })

    for (let i = startIdx; i <= endIdx; i++) {
      ast.tokens[i].val = classList[i - startIdx]
    }
  }
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformSvelte(ast, { env, changes }) {
  let { staticAttrs } = env.customizations

  for (let attr of ast.attributes ?? []) {
    if (!staticAttrs.has(attr.name) || attr.type !== 'Attribute') {
      continue
    }

    for (let i = 0; i < attr.value.length; i++) {
      let value = attr.value[i]
      if (value.type === 'Text') {
        let same = value.raw === value.data
        value.raw = sortClasses(value.raw, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(value.raw),
          ignoreLast: i < attr.value.length - 1 && !/\s$/.test(value.raw),
        })
        value.data = same
          ? value.raw
          : sortClasses(value.data, {
              env,
              ignoreFirst: i > 0 && !/^\s/.test(value.data),
              ignoreLast: i < attr.value.length - 1 && !/\s$/.test(value.data),
            })
      } else if (value.type === 'MustacheTag') {
        visit(value.expression, {
          Literal(node) {
            if (isStringLiteral(node)) {
              if (sortStringLiteral(node, { env })) {
                changes.push({ text: node.raw, loc: node.loc })
              }
            }
          },
          TemplateLiteral(node) {
            if (sortTemplateLiteral(node, { env })) {
              for (let quasi of node.quasis) {
                changes.push({ text: quasi.value.raw, loc: quasi.loc })
              }
            }
          },
        })
      }
    }
  }

  for (let child of ast.children ?? []) {
    transformSvelte(child, { env, changes })
  }

  if (ast.type === 'IfBlock') {
    for (let child of ast.else?.children ?? []) {
      transformSvelte(child, { env, changes })
    }
  }

  if (ast.type === 'AwaitBlock') {
    let nodes = [ast.pending, ast.then, ast.catch]

    for (let child of nodes) {
      transformSvelte(child, { env, changes })
    }
  }

  if (ast.html) {
    transformSvelte(ast.html, { env, changes })
  }
}

export { options } from './options.js'

export const printers = {
  ...(base.printers['svelte-ast']
    ? {
        'svelte-ast': {
          ...base.printers['svelte-ast'],
          print: (path, options, print) => {
            if (!options.__mutatedOriginalText) {
              options.__mutatedOriginalText = true
              let changes = path.stack[0].changes
              if (changes?.length) {
                let finder = lineColumn(options.originalText)

                for (let change of changes) {
                  let start = finder.toIndex(
                    change.loc.start.line,
                    change.loc.start.column + 1,
                  )
                  let end = finder.toIndex(
                    change.loc.end.line,
                    change.loc.end.column + 1,
                  )

                  options.originalText =
                    options.originalText.substring(0, start) +
                    change.text +
                    options.originalText.substring(end)
                }
              }
            }

            return base.printers['svelte-ast'].print(path, options, print)
          },
        },
      }
    : {}),
}

export const parsers = {
  html: createParser('html', transformHtml, {
    staticAttrs: ['class'],
  }),
  glimmer: createParser('glimmer', transformGlimmer, {
    staticAttrs: ['class'],
  }),
  lwc: createParser('lwc', transformHtml, {
    staticAttrs: ['class'],
  }),
  angular: createParser('angular', transformHtml, {
    staticAttrs: ['class'],
    dynamicAttrs: ['[ngClass]'],
  }),
  vue: createParser('vue', transformHtml, {
    staticAttrs: ['class'],
    dynamicAttrs: [':class', 'v-bind:class'],
  }),

  css: createParser('css', transformCss),
  scss: createParser('scss', transformCss),
  less: createParser('less', transformCss),
  babel: createParser('babel', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  'babel-flow': createParser('babel-flow', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  flow: createParser('flow', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  typescript: createParser('typescript', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  'babel-ts': createParser('babel-ts', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  espree: createParser('espree', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  meriyah: createParser('meriyah', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  __js_expression: createParser('__js_expression', transformJavaScript, {
    staticAttrs: ['class', 'className'],
  }),

  ...(base.parsers.svelte
    ? {
        svelte: createParser('svelte', transformSvelte, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
  ...(base.parsers.astro
    ? {
        astro: createParser('astro', transformAstro, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
  ...(base.parsers.marko
    ? {
        marko: createParser('marko', transformMarko, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
  ...(base.parsers.melody
    ? {
        melody: createParser('melody', transformMelody, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
  ...(base.parsers.pug
    ? {
        pug: createParser('pug', transformPug, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
  ...(base.parsers['liquid-html']
    ? {
        'liquid-html': createParser('liquid-html', transformLiquid, {
          staticAttrs: ['class'],
        }),
      }
    : {}),
}

/**
 *
 * @returns {{parsers: Record<string, import('prettier').Parser<any>>, printers: Record<string, import('prettier').Printer<any>>}}
 */
function getBasePlugins() {
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
      espree: prettierParserEspree.parsers.espree,
      meriyah: prettierParserMeriyah.parsers.meriyah,
      __js_expression: prettierParserBabel.parsers.__js_expression,

      ...getAdditionalParsers(),
    },
    printers: {
      ...getAdditionalPrinters(),
    },
  }
}
