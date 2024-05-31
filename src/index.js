// @ts-check
// @ts-ignore
import * as astTypes from 'ast-types'
import jsesc from 'jsesc'
import lineColumn from 'line-column'
import * as prettierParserAngular from 'prettier/plugins/angular'
import * as prettierParserBabel from 'prettier/plugins/babel'
// @ts-ignore
import * as recast from 'recast'
import { getTailwindConfig } from './config.js'
import { getCustomizations } from './options.js'
import { loadPlugins } from './plugins.js'
import { sortClasses, sortClassList } from './sorting.js'
import { spliceChangesIntoString, visit } from './utils.js'

let base = await loadPlugins()

/** @typedef {import('./types.js').Customizations} Customizations */
/** @typedef {import('./types.js').TransformerContext} TransformerContext */
/** @typedef {import('./types.js').TransformerMetadata} TransformerMetadata */
/** @typedef {import('./types.js').StringChange} StringChange */

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
      let original = base.originalParser(parserFormat, options)

      return original.preprocess ? original.preprocess(code, options) : code
    },

    /**
     *
     * @param {string} text
     * @param {import('prettier').ParserOptions} options
     * @returns
     */
    async parse(text, options) {
      let { context, generateRules } = await getTailwindConfig(options)

      let original = base.originalParser(parserFormat, options)

      if (original.astFormat in printers) {
        options.printer = printers[original.astFormat]
      }

      // @ts-ignore: We pass three options in the case of plugins that support Prettier 2 _and_ 3.
      let ast = await original.parse(text, options, options)

      let customizations = getCustomizations(
        options,
        parserFormat,
        customizationDefaults,
      )

      let changes = []

      transform(ast, {
        env: { context, customizations, generateRules, parsers: {}, options },
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

  let changes = []

  visit(directiveAst, {
    StringLiteral(node, parent, key) {
      if (!node.value) return

      let isConcat =
        parent.type === 'BinaryExpression' && parent.operator === '+'

      changes.push({
        start: node.start + 1,
        end: node.end - 1,
        before: node.value,
        after: sortClasses(node.value, {
          env,
          collapseWhitespace: {
            start: !(isConcat && key === 'right'),
            end: !(isConcat && key === 'left'),
          },
        }),
      })
    },
  })

  attr.value = spliceChangesIntoString(attr.value, changes)
}

function transformDynamicJsAttribute(attr, env) {
  let { functions } = env.customizations

  let ast = recast.parse(`let __prettier_temp__ = ${attr.value}`, {
    parser: prettierParserBabel.parsers['babel-ts'],
  })

  let didChange = false

  astTypes.visit(ast, {
    visitLiteral(path) {
      let isConcat =
        path.parent.value.type === 'BinaryExpression' &&
        path.parent.value.operator === '+'
      let key = path.name

      if (isStringLiteral(path.node)) {
        let sorted = sortStringLiteral(path.node, {
          env,
          collapseWhitespace: {
            start: !(isConcat && key === 'right'),
            end: !(isConcat && key === 'left'),
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
      let isConcat =
        path.parent.value.type === 'BinaryExpression' &&
        path.parent.value.operator === '+'
      let key = path.name
      let sorted = sortTemplateLiteral(path.node, {
        env,
        collapseWhitespace: {
          start: !(isConcat && key === 'right'),
          end: !(isConcat && key === 'left'),
        },
      })

      if (sorted) {
        didChange = true
      }

      this.traverse(path)
    },

    visitTaggedTemplateExpression(path) {
      let isConcat =
        path.parent.value.type === 'BinaryExpression' &&
        path.parent.value.operator === '+'
      let key = path.name

      if (isSortableTemplateExpression(path.node, functions)) {
        let sorted = sortTemplateLiteral(path.node.quasi, {
          env,
          collapseWhitespace: {
            start: !(isConcat && key === 'right'),
            end: !(isConcat && key === 'left'),
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
        collapseWhitespace: {
          start: !siblings?.prev,
          end: !siblings?.next,
        },
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
        collapseWhitespace: {
          start: false,
          end: !isConcat,
        },
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

  /** @type {StringChange[]} */
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
        let after = sortClasses(node.value, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(node.value),
          ignoreLast: i < attr.value.length - 1 && !/\s$/.test(node.value),
          removeDuplicates: false,
          collapseWhitespace: false,
        })

        changes.push({
          start: node.position.start,
          end: node.position.end,
          before: node.value,
          after,
        })
      } else if (
        // @ts-ignore: `LiquidDrop` is for older versions of the liquid plugin (1.2.x)
        (node.type === 'LiquidDrop' || node.type === 'LiquidVariableOutput') &&
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

            let after = sortClasses(node.value, { env })

            changes.push({
              start: pos.start,
              end: pos.end,
              before: node.value,
              after,
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

  for (let node of sources) {
    node.source = spliceChangesIntoString(node.source, changes)
  }
}

function sortStringLiteral(
  node,
  { env, collapseWhitespace = { start: true, end: true } },
) {
  let result = sortClasses(node.value, {
    env,
    collapseWhitespace,
  })
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

function sortTemplateLiteral(
  node,
  { env, collapseWhitespace = { start: true, end: true } },
) {
  let didChange = false

  for (let i = 0; i < node.quasis.length; i++) {
    let quasi = node.quasis[i]
    let same = quasi.value.raw === quasi.value.cooked
    let originalRaw = quasi.value.raw
    let originalCooked = quasi.value.cooked

    quasi.value.raw = sortClasses(quasi.value.raw, {
      env,
      // Is not the first "item" and does not start with a space
      ignoreFirst: i > 0 && !/^\s/.test(quasi.value.raw),

      // Is between two expressions
      // And does not end with a space
      ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.raw),

      collapseWhitespace: {
        start: collapseWhitespace && collapseWhitespace.start && i === 0,
        end:
          collapseWhitespace &&
          collapseWhitespace.end &&
          i >= node.expressions.length,
      },
    })

    quasi.value.cooked = same
      ? quasi.value.raw
      : sortClasses(quasi.value.cooked, {
          env,
          ignoreFirst: i > 0 && !/^\s/.test(quasi.value.cooked),
          ignoreLast:
            i < node.expressions.length && !/\s$/.test(quasi.value.cooked),
          collapseWhitespace: {
            start: collapseWhitespace && collapseWhitespace.start && i === 0,
            end:
              collapseWhitespace &&
              collapseWhitespace.end &&
              i >= node.expressions.length,
          },
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
 *
 * @param {import('@babel/types').CallExpression | import('ast-types').namedTypes.CallExpression} node
 * @param {Set<string>} functions
 * @returns {boolean}
 */
function isSortableCallExpression(node, functions) {
  if (!node.arguments?.length) {
    return false
  }

  if (node.callee.type === 'Identifier') {
    return functions.has(node.callee.name)
  }

  if (node.callee.type === 'MemberExpression') {
    let expr = node.callee.object

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
    visit(ast, (node, parent, key) => {
      let isConcat =
        parent?.type === 'BinaryExpression' && parent?.operator === '+'

      if (isStringLiteral(node)) {
        sortStringLiteral(node, {
          env,
          collapseWhitespace: {
            start: !(isConcat && key === 'right'),
            end: !(isConcat && key === 'left'),
          },
        })
      } else if (node.type === 'TemplateLiteral') {
        sortTemplateLiteral(node, {
          env,
          collapseWhitespace: {
            start: !(isConcat && key === 'right'),
            end: !(isConcat && key === 'left'),
          },
        })
      } else if (node.type === 'TaggedTemplateExpression') {
        if (isSortableTemplateExpression(node, functions)) {
          sortTemplateLiteral(node.quasi, {
            env,
            collapseWhitespace: {
              start: !(isConcat && key === 'right'),
              end: !(isConcat && key === 'left'),
            },
          })
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

      // We don't want to support namespaced attributes (e.g. `somens:class`)
      // React doesn't support them and most tools don't either
      if (typeof node.name.name !== 'string') {
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
      if (!isSortableCallExpression(node, functions)) {
        return
      }

      node.arguments.forEach((arg) => sortInside(arg))
    },

    /** @param {import('@babel/types').TaggedTemplateExpression} node */
    TaggedTemplateExpression(node, parent, key) {
      if (!isSortableTemplateExpression(node, functions)) {
        return
      }

      let isConcat =
        parent?.type === 'BinaryExpression' && parent?.operator === '+'

      sortTemplateLiteral(node.quasi, {
        env,
        collapseWhitespace: {
          start: !(isConcat && key === 'right'),
          end: !(isConcat && key === 'left'),
        },
      })
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
      let isImportant = /\s+(?:!important|#{(['"]*)!important\1})\s*$/.test(
        node.params,
      )

      node.params = sortClasses(node.params, {
        env,
        ignoreLast: isImportant,
        collapseWhitespace: {
          start: false,
          end: !isImportant,
        },
      })
    }
  })
}

/**
 * @param {any} ast
 * @param {TransformerContext} param1
 */
function transformAstro(ast, { env, changes }) {
  let { staticAttrs, dynamicAttrs } = env.customizations

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
      } else if (
        dynamicAttrs.has(attr.name) &&
        attr.type === 'attribute' &&
        attr.kind === 'expression' &&
        typeof attr.value === 'string'
      ) {
        transformDynamicJsAttribute(attr, env)
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

      const isConcat =
        parent.type === 'BinaryConcatExpression' ||
        parent.type === 'BinaryAddExpression'

      node.value = sortClasses(node.value, {
        env,
        ignoreFirst:
          isConcat && _key === 'right' && !/^[^\S\r\n]/.test(node.value),
        ignoreLast:
          isConcat && _key === 'left' && !/[^\S\r\n]$/.test(node.value),
        collapseWhitespace: {
          start: !(isConcat && _key === 'right'),
          end: !(isConcat && _key === 'left'),
        },
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
          removeDuplicates: false,
          collapseWhitespace: false,
        })
        value.data = same
          ? value.raw
          : sortClasses(value.data, {
              env,
              ignoreFirst: i > 0 && !/^\s/.test(value.data),
              ignoreLast: i < attr.value.length - 1 && !/\s$/.test(value.data),
              removeDuplicates: false,
              collapseWhitespace: false,
            })
      } else if (value.type === 'MustacheTag') {
        visit(value.expression, {
          Literal(node, parent, key) {
            if (isStringLiteral(node)) {
              let before = node.raw
              let sorted = sortStringLiteral(node, {
                env,
                removeDuplicates: false,
                collapseWhitespace: false,
              })

              if (sorted) {
                changes.push({
                  before,
                  after: node.raw,
                  start: node.loc.start,
                  end: node.loc.end,
                })
              }
            }
          },
          TemplateLiteral(node, parent, key) {
            let before = node.quasis.map((quasi) => quasi.value.raw)
            let sorted = sortTemplateLiteral(node, {
              env,
              removeDuplicates: false,
              collapseWhitespace: false,
            })

            if (sorted) {
              for (let [idx, quasi] of node.quasis.entries()) {
                changes.push({
                  before: before[idx],
                  after: quasi.value.raw,
                  start: quasi.loc.start,
                  end: quasi.loc.end,
                })
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

export const printers = (function () {
  let printers = {}

  if (base.printers['svelte-ast']) {
    function mutateOriginalText(path, options) {
      if (options.__mutatedOriginalText) {
        return
      }

      options.__mutatedOriginalText = true

      let changes = path.stack[0].changes

      if (changes?.length) {
        let finder = lineColumn(options.originalText)

        changes = changes.map((change) => {
          return {
            ...change,
            start: finder.toIndex(change.start.line, change.start.column + 1),
            end: finder.toIndex(change.end.line, change.end.column + 1),
          }
        })

        options.originalText = spliceChangesIntoString(
          options.originalText,
          changes,
        )
      }
    }

    let original = base.printers['svelte-ast']
    printers['svelte-ast'] = {
      ...original,
      print: (path, options, print) => {
        mutateOriginalText(path, options)

        return base.printers['svelte-ast'].print(path, options, print)
      },
      embed: (path, options) => {
        mutateOriginalText(path, options)

        // @ts-ignore
        return base.printers['svelte-ast'].embed(path, options)
      },
    }
  }

  return printers
})()

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

  acorn: createParser('acorn', transformJavaScript, {
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
          staticAttrs: ['class', 'className'],
          dynamicAttrs: ['class:list', 'className'],
        }),
      }
    : {}),
  ...(base.parsers.astroExpressionParser
    ? {
        astroExpressionParser: createParser(
          'astroExpressionParser',
          transformJavaScript,
          {
            staticAttrs: ['class'],
            dynamicAttrs: ['class:list'],
          },
        ),
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
