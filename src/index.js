import {
  getCompatibleParser,
  getAdditionalParsers,
  getAdditionalPrinters,
} from './compat.js'
import { getTailwindConfig } from './config.js'
import { sortClasses, sortClassList } from './sorting.js'
import { visit } from './utils.js'
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

let base = getBasePlugins()

function createParser(parserFormat, transform) {
  return {
    ...base.parsers[parserFormat],
    preprocess(code, options) {
      let original = getCompatibleParser(base, parserFormat, options)

      return original.preprocess ? original.preprocess(code, options) : code
    },

    parse(text, parsers, options = {}) {
      let { context, generateRules } = getTailwindConfig(options)

      let original = getCompatibleParser(base, parserFormat, options)

      if (original.astFormat in printers) {
        options.printer = printers[original.astFormat]
      }

      let ast = original.parse(text, parsers, options)
      transform(ast, { env: { context, generateRules, parsers, options } })
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

function transformHtml(
  attributes,
  computedAttributes = [],
  computedType = 'js',
) {
  let transform = (ast, { env }) => {
    for (let attr of ast.attrs ?? []) {
      if (attributes.includes(attr.name)) {
        attr.value = sortClasses(attr.value, { env })
      } else if (computedAttributes.includes(attr.name)) {
        if (!/[`'"]/.test(attr.value)) {
          continue
        }

        if (computedType === 'angular') {
          let directiveAst = tryParseAngularAttribute(attr.value, env)

          // If we've reached this point we couldn't parse the expression we we should bail
          // `tryParseAngularAttribute` will display some warnings/errors
          // But we shouldn't fail outright — just miss parsing some attributes
          if (!directiveAst) {
            continue
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
          continue
        }

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
                let quote = path.node.extra.raw[0]
                let value = jsesc(path.node.value, {
                  quotes: quote === "'" ? 'single' : 'double',
                })
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
        })

        if (didChange) {
          attr.value = recast.print(
            ast.program.body[0].declarations[0].init,
          ).code
        }
      }
    }

    for (let child of ast.children ?? []) {
      transform(child, { env })
    }
  }
  return transform
}

function transformGlimmer(ast, { env }) {
  visit(ast, {
    AttrNode(attr, parent, key, index, meta) {
      let attributes = ['class']

      if (attributes.includes(attr.name) && attr.value) {
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

function transformLiquid(ast, { env }) {
  /** @param {{name: string | {type: string, value: string}[]}} node */
  function isClassAttr(node) {
    return Array.isArray(node.name)
      ? node.name.every((n) => n.type === 'TextNode' && n.value === 'class')
      : node.name === 'class'
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

  function sortAttribute(attr) {
    visit(attr.value, {
      TextNode(node) {
        node.value = sortClasses(node.value, { env })
        changes.push({
          pos: node.position,
          value: node.value,
        })
      },

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
    return a.start - b.start || a.end - b.end
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

function transformJavaScript(ast, { env }) {
  visit(ast, {
    JSXAttribute(node) {
      if (!node.value) {
        return
      }
      if (['class', 'className'].includes(node.name.name)) {
        if (isStringLiteral(node.value)) {
          sortStringLiteral(node.value, { env })
        } else if (node.value.type === 'JSXExpressionContainer') {
          visit(node.value, (node, parent, key) => {
            if (isStringLiteral(node)) {
              sortStringLiteral(node, { env })
            } else if (node.type === 'TemplateLiteral') {
              sortTemplateLiteral(node, { env })
            }
          })
        }
      }
    },
  })
}

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

export const options = {
  tailwindConfig: {
    type: 'string',
    category: 'Tailwind CSS',
    description: 'TODO',
  },
}

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
  html: createParser('html', transformHtml(['class'])),
  glimmer: createParser('glimmer', transformGlimmer),
  lwc: createParser('lwc', transformHtml(['class'])),
  angular: createParser(
    'angular',
    transformHtml(['class'], ['[ngClass]'], 'angular'),
  ),
  vue: createParser('vue', transformHtml(['class'], [':class'])),
  css: createParser('css', transformCss),
  scss: createParser('scss', transformCss),
  less: createParser('less', transformCss),
  babel: createParser('babel', transformJavaScript),
  'babel-flow': createParser('babel-flow', transformJavaScript),
  flow: createParser('flow', transformJavaScript),
  typescript: createParser('typescript', transformJavaScript),
  'babel-ts': createParser('babel-ts', transformJavaScript),
  espree: createParser('espree', transformJavaScript),
  meriyah: createParser('meriyah', transformJavaScript),
  __js_expression: createParser('__js_expression', transformJavaScript),
  ...(base.parsers.svelte
    ? {
        svelte: createParser('svelte', (ast, { env }) => {
          let changes = []
          transformSvelte(ast.html, { env, changes })
          ast.changes = changes
        }),
      }
    : {}),
  ...(base.parsers.astro
    ? { astro: createParser('astro', transformAstro) }
    : {}),
  ...(base.parsers.marko
    ? { marko: createParser('marko', transformMarko) }
    : {}),
  ...(base.parsers.melody
    ? { melody: createParser('melody', transformMelody) }
    : {}),
  ...(base.parsers.pug ? { pug: createParser('pug', transformPug) } : {}),
  ...(base.parsers['liquid-html']
    ? { 'liquid-html': createParser('liquid-html', transformLiquid) }
    : {}),
}

function transformAstro(ast, { env }) {
  if (
    ast.type === 'element' ||
    ast.type === 'custom-element' ||
    ast.type === 'component'
  ) {
    for (let attr of ast.attributes ?? []) {
      if (
        attr.name === 'class' &&
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
    transformAstro(child, { env })
  }
}

function transformMarko(ast, { env }) {
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
        if (currentNode.name === 'class') {
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
        }
        break
    }
  }
}

function transformMelody(ast, { env }) {
  for (let child of ast.expressions ?? []) {
    transformMelody(child, { env })
  }

  visit(ast, {
    Attribute(node, _parent, _key, _index, meta) {
      if (node.name.name !== 'class') {
        return
      }

      meta.sortTextNodes = true
    },

    StringLiteral(node, _parent, _key, _index, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      node.value = sortClasses(node.value, {
        env,
      })
    },
  })
}

function transformPug(ast, { env }) {
  // This isn't optimal
  // We should merge the classes together across class attributes and class tokens
  // And then we sort them
  // But this is good enough for now

  // First sort the classes in attributes
  for (const token of ast.tokens) {
    if (token.type === 'attribute' && token.name === 'class') {
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

function transformSvelte(ast, { env, changes }) {
  for (let attr of ast.attributes ?? []) {
    if (attr.name === 'class' && attr.type === 'Attribute') {
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
                ignoreLast:
                  i < attr.value.length - 1 && !/\s$/.test(value.data),
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
}

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
