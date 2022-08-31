import prettier from 'prettier'
import prettierParserHTML from 'prettier/parser-html'
import prettierParserAngular from 'prettier/parser-angular'
import prettierParserPostCSS from 'prettier/parser-postcss'
import prettierParserBabel from 'prettier/parser-babel'
import prettierParserEspree from 'prettier/parser-espree'
import prettierParserGlimmer from 'prettier/parser-glimmer'
import prettierParserMeriyah from 'prettier/parser-meriyah'
import prettierParserFlow from 'prettier/parser-flow'
import prettierParserTypescript from 'prettier/parser-typescript'
import { createContext as createContextFallback } from 'tailwindcss/lib/lib/setupContextUtils'
import { generateRules as generateRulesFallback } from 'tailwindcss/lib/lib/generateRules'
import resolveConfigFallback from 'tailwindcss/resolveConfig'
import * as recast from 'recast'
import * as astTypes from 'ast-types'
import * as path from 'path'
import requireFrom from 'import-from'
import requireFresh from 'import-fresh'
import objectHash from 'object-hash'
import * as svelte from 'prettier-plugin-svelte'
import lineColumn from 'line-column'
import jsesc from 'jsesc'
import escalade from 'escalade/sync'

// We need to load this plugin dynamically because it's not available by default
// And we are not bundling it with the main Prettier plugin
let astro = loadIfExists('prettier-plugin-astro')

let contextMap = new Map()

function bigSign(bigIntValue) {
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

function prefixCandidate(context, selector) {
  let prefix = context.tailwindConfig.prefix
  return typeof prefix === 'function' ? prefix(selector) : prefix + selector
}

// Polyfill for older Tailwind CSS versions
function getClassOrderPolyfill(classes, { env }) {
  // A list of utilities that are used by certain Tailwind CSS utilities but
  // that don't exist on their own. This will result in them "not existing" and
  // sorting could be weird since you still require them in order to make the
  // host utitlies work properly. (Thanks Biology)
  let parasiteUtilities = new Set([
    prefixCandidate(env.context, 'group'),
    prefixCandidate(env.context, 'peer'),
  ])

  let classNamesWithOrder = []

  for (let className of classes) {
    let order =
      env
        .generateRules(new Set([className]), env.context)
        .sort(([a], [z]) => bigSign(z - a))[0]?.[0] ?? null

    if (order === null && parasiteUtilities.has(className)) {
      // This will make sure that it is at the very beginning of the
      // `components` layer which technically means 'before any
      // components'.
      order = env.context.layerOrder.components
    }

    classNamesWithOrder.push([className, order])
  }

  return classNamesWithOrder
}

function sortClasses(classStr, { env, ignoreFirst = false, ignoreLast = false }) {
  if (typeof classStr !== 'string' || classStr === '') {
    return classStr
  }

  // Ignore class attributes containing `{{`, to match Prettier behaviour:
  // https://github.com/prettier/prettier/blob/main/src/language-html/embed.js#L83-L88
  if (classStr.includes('{{')) {
    return classStr
  }

  let result = ''
  let parts = classStr.split(/(\s+)/)
  let classes = parts.filter((_, i) => i % 2 === 0)
  let whitespace = parts.filter((_, i) => i % 2 !== 0)

  if (classes[classes.length - 1] === '') {
    classes.pop()
  }

  let prefix = ''
  if (ignoreFirst) {
    prefix = `${classes.shift() ?? ''}${whitespace.shift() ?? ''}`
  }

  let suffix = ''
  if (ignoreLast) {
    suffix = `${whitespace.pop() ?? ''}${classes.pop() ?? ''}`
  }

  let classNamesWithOrder = env.context.getClassOrder
    ? env.context.getClassOrder(classes)
    : getClassOrderPolyfill(classes, { env })

  classes = classNamesWithOrder
    .sort(([, a], [, z]) => {
      if (a === z) return 0
      // if (a === null) return options.unknownClassPosition === 'start' ? -1 : 1
      // if (z === null) return options.unknownClassPosition === 'start' ? 1 : -1
      if (a === null) return -1
      if (z === null) return 1
      return bigSign(a - z)
    })
    .map(([className]) => className)

  for (let i = 0; i < classes.length; i++) {
    result += `${classes[i]}${whitespace[i] ?? ''}`
  }

  return prefix + result + suffix
}

function createParser(original, transform) {
  return {
    ...original,
    parse(text, parsers, options = {}) {
      let ast = original.parse(text, parsers, options)
      let tailwindConfigPath = '__default__'
      let tailwindConfig = {}
      let resolveConfig = resolveConfigFallback
      let createContext = createContextFallback
      let generateRules = generateRulesFallback

      let baseDir
      let prettierConfigPath = prettier.resolveConfigFile.sync(options.filepath)

      if (options.tailwindConfig) {
        baseDir = prettierConfigPath ? path.dirname(prettierConfigPath) : process.cwd()
        tailwindConfigPath = path.resolve(baseDir, options.tailwindConfig)
        tailwindConfig = requireFresh(tailwindConfigPath)
      } else {
        baseDir = prettierConfigPath
          ? path.dirname(prettierConfigPath)
          : options.filepath
          ? path.dirname(options.filepath)
          : process.cwd()
        let configPath
        try {
          configPath = escalade(baseDir, (_dir, names) => {
            if (names.includes('tailwind.config.js')) {
              return 'tailwind.config.js'
            }
            if (names.includes('tailwind.config.cjs')) {
              return 'tailwind.config.cjs'
            }
          })
        } catch {}
        if (configPath) {
          tailwindConfigPath = configPath
          tailwindConfig = requireFresh(configPath)
        }
      }

      try {
        resolveConfig = requireFrom(baseDir, 'tailwindcss/resolveConfig')
        createContext = requireFrom(baseDir, 'tailwindcss/lib/lib/setupContextUtils').createContext
        generateRules = requireFrom(baseDir, 'tailwindcss/lib/lib/generateRules').generateRules
      } catch {}

      // suppress "empty content" warning
      tailwindConfig.content = ['no-op']

      let context
      let existing = contextMap.get(tailwindConfigPath)
      let hash = objectHash(tailwindConfig)

      if (existing && existing.hash === hash) {
        context = existing.context
      } else {
        context = createContext(resolveConfig(tailwindConfig))
        contextMap.set(tailwindConfigPath, { context, hash })
      }

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
      return parser.parse(
        value,
        env.parsers,
        env.options
      )
    } catch (err) {
      errors.push(err)
    }
  }

  console.warn("prettier-plugin-tailwindcss: Unable to parse angular directive")
  errors.forEach(err => console.warn(err))
}

function transformHtml(attributes, computedAttributes = [], computedType = 'js') {
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
          attr.value = recast.print(ast.program.body[0].declarations[0].init).code
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

      node.value = sortClasses(node.value, { env })
    },
  })
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
    node.type === 'StringLiteral' || (node.type === 'Literal' && typeof node.value === 'string')
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
          ignoreLast: i < node.expressions.length && !/\s$/.test(quasi.value.cooked),
        })

    if (quasi.value.raw !== originalRaw || quasi.value.cooked !== originalCooked) {
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
  ...svelte.options,
  tailwindConfig: {
    type: 'string',
    category: 'Tailwind CSS',
    description: 'TODO',
  },
}

export const languages = svelte.languages
export const printers = {
  'svelte-ast': {
    ...svelte.printers['svelte-ast'],
    print: (path, options, print) => {
      if (!options.__mutatedOriginalText) {
        options.__mutatedOriginalText = true
        let changes = path.stack[0].changes
        if (changes?.length) {
          let finder = lineColumn(options.originalText)

          for (let change of changes) {
            let start = finder.toIndex(change.loc.start.line, change.loc.start.column + 1)
            let end = finder.toIndex(change.loc.end.line, change.loc.end.column + 1)

            options.originalText =
              options.originalText.substring(0, start) +
              change.text +
              options.originalText.substring(end)
          }
        }
      }

      return svelte.printers['svelte-ast'].print(path, options, print)
    },
  },
}

export const parsers = {
  html: createParser(prettierParserHTML.parsers.html, transformHtml(['class'])),
  glimmer: createParser(prettierParserGlimmer.parsers.glimmer, transformGlimmer),
  lwc: createParser(prettierParserHTML.parsers.lwc, transformHtml(['class'])),
  angular: createParser(
    prettierParserHTML.parsers.angular,
    transformHtml(['class'], ['[ngClass]'], 'angular')
  ),
  vue: createParser(prettierParserHTML.parsers.vue, transformHtml(['class'], [':class'])),
  css: createParser(prettierParserPostCSS.parsers.css, transformCss),
  scss: createParser(prettierParserPostCSS.parsers.scss, transformCss),
  less: createParser(prettierParserPostCSS.parsers.less, transformCss),
  babel: createParser(prettierParserBabel.parsers.babel, transformJavaScript),
  'babel-flow': createParser(prettierParserBabel.parsers['babel-flow'], transformJavaScript),
  flow: createParser(prettierParserFlow.parsers.flow, transformJavaScript),
  typescript: createParser(prettierParserTypescript.parsers.typescript, transformJavaScript),
  'babel-ts': createParser(prettierParserBabel.parsers['babel-ts'], transformJavaScript),
  espree: createParser(prettierParserEspree.parsers.espree, transformJavaScript),
  meriyah: createParser(prettierParserMeriyah.parsers.meriyah, transformJavaScript),
  __js_expression: createParser(prettierParserBabel.parsers.__js_expression, transformJavaScript),
  svelte: createParser(svelte.parsers.svelte, (ast, { env }) => {
    let changes = []
    transformSvelte(ast.html, { env, changes })
    ast.changes = changes
  }),
  ...astro ? { astro: createParser(astro.parsers.astro, transformAstro) } : {},
}

function transformAstro(ast, { env, changes }) {
  if (ast.type === "element") {
    for (let attr of ast.attributes ?? []) {
      if (attr.name === "class" && attr.type === "attribute" && attr.kind === "quoted") {
        attr.value = sortClasses(attr.value, {
          env
        });
      }
    }
  }

  for (let child of ast.children ?? []) {
    transformAstro(child, { env, changes });
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
  }

  for (let child of ast.children ?? []) {
    transformSvelte(child, { env, changes })
  }

  if (ast.type === 'IfBlock') {
    for (let child of ast.else?.children ?? []) {
      transformSvelte(child, { env, changes })
    }
  }
}

// https://lihautan.com/manipulating-ast-with-javascript/
function visit(ast, callbackMap) {
  function _visit(node, parent, key, index, meta = {}) {
    if (typeof callbackMap === 'function') {
      if (callbackMap(node, parent, key, index, meta) === false) {
        return
      }
    } else if (node.type in callbackMap) {
      if (callbackMap[node.type](node, parent, key, index, meta) === false) {
        return
      }
    }

    const keys = Object.keys(node)
    for (let i = 0; i < keys.length; i++) {
      const child = node[keys[i]]
      if (Array.isArray(child)) {
        for (let j = 0; j < child.length; j++) {
          if (child[j] !== null) {
            _visit(child[j], node, keys[i], j, { ...meta })
          }
        }
      } else if (typeof child?.type === 'string') {
        _visit(child, node, keys[i], i, { ...meta })
      }
    }
  }
  _visit(ast)
}

// For loading prettier plugins only if they exist
function loadIfExists(name) {
  try {
    if (require.resolve(name)) {
      return require(name)
    }
  } catch (e) {
    return null
  }
}
