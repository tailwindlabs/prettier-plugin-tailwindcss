// @ts-ignore
import type * as Liquid from '@shopify/prettier-plugin-liquid/dist/types.js'
// @ts-ignore
import lineColumn from 'line-column'
import * as prettierParserAngular from 'prettier/plugins/angular'
import * as prettierParserBabel from 'prettier/plugins/babel'
import * as prettierParserCss from 'prettier/plugins/postcss'
// @ts-ignore
import { createPlugin } from './create-plugin.js'
import type { Matcher } from './options.js'
import { sortClasses, sortClassList } from './sorting.js'
import { defineTransform, type TransformOptions } from './transform.js'
import type { StringChange, TransformerEnv } from './types'
import { spliceChangesIntoString, visit, type Path } from './utils.js'

const ESCAPE_SEQUENCE_PATTERN = /\\(['"\\nrtbfv0-7xuU])/g
function tryParseAngularAttribute(value: string, env: TransformerEnv) {
  try {
    return prettierParserAngular.parsers.__ng_directive.parse(value, env.options)
  } catch (err) {
    console.warn('prettier-plugin-tailwindcss: Unable to parse angular directive')
    console.warn(err)
    return null
  }
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

      let collapseWhitespace = canCollapseWhitespaceIn(path, env)

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

      let collapseWhitespace = canCollapseWhitespaceIn(path, env)

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

            collapseWhitespace: collapseWhitespace
              ? {
                  start: collapseWhitespace.start && i === 0,
                  end: collapseWhitespace.end && i >= node.expressions.length,
                }
              : false,
          }),
        })
      }
    },
  })

  attr.value = spliceChangesIntoString(attr.value, changes)
}

function transformDynamicJsAttribute(attr: any, env: TransformerEnv) {
  let { matcher } = env

  let expressionPrefix = 'let __prettier_temp__ = '
  let source = `${expressionPrefix}${attr.value}`
  let ast = prettierParserBabel.parsers['babel-ts'].parse(source, env.options)

  let didChange = false
  let changes: StringChange[] = []

  function findConcatEntry(path: Path<any, any>) {
    return path.find(
      (entry) => entry.parent?.type === 'BinaryExpression' && entry.parent.operator === '+',
    )
  }

  function addChange(start: number | null | undefined, end: number | null | undefined, after: string) {
    if (start == null || end == null) return

    let offsetStart = start - expressionPrefix.length
    let offsetEnd = end - expressionPrefix.length

    if (offsetStart < 0 || offsetEnd < 0) return

    didChange = true
    changes.push({
      start: offsetStart,
      end: offsetEnd,
      before: attr.value.slice(offsetStart, offsetEnd),
      after,
    })
  }

  visit(ast, {
    StringLiteral(node, path) {
      let concat = findConcatEntry(path)
      let sorted = sortStringLiteral(node, {
        env,
        collapseWhitespace: {
          start: concat?.key !== 'right',
          end: concat?.key !== 'left',
        },
      })

      if (sorted) {
        // @ts-ignore
        let raw = node.extra?.raw ?? node.raw
        if (typeof raw === 'string') {
          addChange(node.start, node.end, raw)
        }
      }
    },

    Literal(node: any, path) {
      if (!isStringLiteral(node)) return

      let concat = findConcatEntry(path)
      let sorted = sortStringLiteral(node, {
        env,
        collapseWhitespace: {
          start: concat?.key !== 'right',
          end: concat?.key !== 'left',
        },
      })

      if (sorted) {
        // @ts-ignore
        let raw = node.extra?.raw ?? node.raw
        if (typeof raw === 'string') {
          addChange(node.start, node.end, raw)
        }
      }
    },

    TemplateLiteral(node, path) {
      let concat = findConcatEntry(path)
      let originalQuasis = node.quasis.map((quasi) => quasi.value.raw)
      let sorted = sortTemplateLiteral(node, {
        env,
        collapseWhitespace: {
          start: concat?.key !== 'right',
          end: concat?.key !== 'left',
        },
      })

      if (sorted) {
        for (let i = 0; i < node.quasis.length; i++) {
          let quasi = node.quasis[i]
          if (quasi.value.raw !== originalQuasis[i]) {
            addChange(quasi.start, quasi.end, quasi.value.raw)
          }
        }
      }
    },

    TaggedTemplateExpression(node, path) {
      if (!isSortableTemplateExpression(node, matcher)) {
        return
      }

      let concat = findConcatEntry(path)
      let originalQuasis = node.quasi.quasis.map((quasi) => quasi.value.raw)
      let sorted = sortTemplateLiteral(node.quasi, {
        env,
        collapseWhitespace: {
          start: concat?.key !== 'right',
          end: concat?.key !== 'left',
        },
      })

      if (sorted) {
        for (let i = 0; i < node.quasi.quasis.length; i++) {
          let quasi = node.quasi.quasis[i]
          if (quasi.value.raw !== originalQuasis[i]) {
            addChange(quasi.start, quasi.end, quasi.value.raw)
          }
        }
      }
    },
  })

  if (didChange) {
    attr.value = spliceChangesIntoString(attr.value, changes)
  }
}

function transformHtml(ast: any, env: TransformerEnv) {
  let { matcher } = env
  let { parser } = env.options

  for (let attr of ast.attrs ?? []) {
    if (matcher.hasStaticAttr(attr.name)) {
      attr.value = sortClasses(attr.value, { env })
    } else if (matcher.hasDynamicAttr(attr.name)) {
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
    transformHtml(child, env)
  }
}

function transformGlimmer(ast: any, env: TransformerEnv) {
  let { matcher } = env

  visit(ast, {
    AttrNode(attr, _path, meta) {
      if (matcher.hasStaticAttr(attr.name) && attr.value) {
        meta.sortTextNodes = true
      }
    },

    TextNode(node, path, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      let concat = path.find((entry) => {
        return entry.parent && entry.parent.type === 'ConcatStatement'
      })

      let siblings = {
        prev: concat?.parent.parts[concat.index! - 1],
        next: concat?.parent.parts[concat.index! + 1],
      }

      node.chars = sortClasses(node.chars, {
        env,
        ignoreFirst: siblings.prev && !/^\s/.test(node.chars),
        ignoreLast: siblings.next && !/\s$/.test(node.chars),
        collapseWhitespace: {
          start: !siblings.prev,
          end: !siblings.next,
        },
      })
    },

    StringLiteral(node, path, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      let concat = path.find((entry) => {
        return (
          entry.parent &&
          entry.parent.type === 'SubExpression' &&
          entry.parent.path.original === 'concat'
        )
      })

      node.value = sortClasses(node.value, {
        env,
        ignoreLast: Boolean(concat) && !/[^\S\r\n]$/.test(node.value),
        collapseWhitespace: {
          start: false,
          end: !concat,
        },
      })
    },
  })
}

function transformLiquid(ast: any, env: TransformerEnv) {
  let { matcher } = env

  function isClassAttr(node: { name: string | { type: string; value: string }[] }) {
    return Array.isArray(node.name)
      ? node.name.every((n) => n.type === 'TextNode' && matcher.hasStaticAttr(n.value))
      : matcher.hasStaticAttr(node.name)
  }

  function hasSurroundingQuotes(str: string) {
    let start = str[0]
    let end = str[str.length - 1]

    return start === end && (start === '"' || start === "'" || start === '`')
  }

  let sources: { type: string; source: string }[] = []

  let changes: StringChange[] = []

  function sortAttribute(attr: Liquid.AttrSingleQuoted | Liquid.AttrDoubleQuoted) {
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
          String(node: any) {
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
    LiquidTag(node: any) {
      sources.push(node)
    },

    HtmlElement(node: any) {
      sources.push(node)
    },

    AttrSingleQuoted(node: any) {
      if (isClassAttr(node)) {
        sources.push(node)
        sortAttribute(node)
      }
    },

    AttrDoubleQuoted(node: any) {
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
  return (
    node.type === 'StringLiteral' || (node.type === 'Literal' && typeof node.value === 'string')
  )
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
  node: import('@babel/types').TaggedTemplateExpression,
  matcher: Matcher,
): boolean {
  return isSortableExpression(node.tag, matcher)
}

function isSortableCallExpression(
  node: import('@babel/types').CallExpression,
  matcher: Matcher,
): boolean {
  if (!node.arguments?.length) return false

  return isSortableExpression(node.callee, matcher)
}

function isSortableExpression(
  node: import('@babel/types').Expression | import('@babel/types').V8IntrinsicIdentifier,
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

function canCollapseWhitespaceIn(
  path: Path<import('@babel/types').Node, any>,
  env: TransformerEnv,
): false | { start: boolean; end: boolean } {
  if (env.options.tailwindPreserveWhitespace) {
    return false
  }

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
        let quasiStart = quasi.start ?? null
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

// TODO: The `ast` types here aren't strictly correct.
//
// We cross several parsers that share roughly the same shape so things are
// good enough. The actual AST we should be using is probably estree + ts.
function transformJavaScript(ast: import('@babel/types').Node, env: TransformerEnv) {
  let { matcher } = env

  function sortInside(ast: import('@babel/types').Node) {
    visit(ast, (node, path) => {
      let collapseWhitespace = canCollapseWhitespaceIn(path, env)

      if (isStringLiteral(node)) {
        sortStringLiteral(node, { env, collapseWhitespace })
      } else if (node.type === 'TemplateLiteral') {
        sortTemplateLiteral(node, { env, collapseWhitespace })
      } else if (node.type === 'TaggedTemplateExpression') {
        if (isSortableTemplateExpression(node, matcher)) {
          sortTemplateLiteral(node.quasi, { env, collapseWhitespace })
        }
      }
    })
  }

  visit(ast, {
    JSXAttribute(node) {
      node = node as import('@babel/types').JSXAttribute

      if (!node.value) {
        return
      }

      // We don't want to support namespaced attributes (e.g. `somens:class`)
      // React doesn't support them and most tools don't either
      if (typeof node.name.name !== 'string') {
        return
      }

      if (!matcher.hasStaticAttr(node.name.name)) {
        return
      }

      if (isStringLiteral(node.value)) {
        sortStringLiteral(node.value, { env })
      } else if (node.value.type === 'JSXExpressionContainer') {
        sortInside(node.value)
      }
    },

    CallExpression(node) {
      node = node as import('@babel/types').CallExpression

      if (!isSortableCallExpression(node, matcher)) {
        return
      }

      node.arguments.forEach((arg) => sortInside(arg))
    },

    TaggedTemplateExpression(node, path) {
      node = node as import('@babel/types').TaggedTemplateExpression

      if (!isSortableTemplateExpression(node, matcher)) {
        return
      }

      let collapseWhitespace = canCollapseWhitespaceIn(path, env)

      sortTemplateLiteral(node.quasi, {
        env,
        collapseWhitespace,
      })
    },
  })
}

function transformCss(ast: any, env: TransformerEnv) {
  // `parseValue` inside Prettier's CSS parser is private API so we have to
  // produce the same result by parsing an import statement with the same params
  function tryParseAtRuleParams(name: string, params: any) {
    // It might already be an object or array. Could happen in the future if
    // Prettier decides to start parsing these.
    if (typeof params !== 'string') return params

    // Otherwise we let prettier re-parse the params into its custom value AST
    // based on postcss-value parser.
    try {
      let parser = prettierParserCss.parsers.css

      let root = parser.parse(`@import ${params};`, {
        // We can't pass env.options directly because css.parse overwrites
        // options.originalText which is used during the printing phase
        ...env.options,
      })

      return root.nodes[0].params
    } catch (err) {
      console.warn(`[prettier-plugin-tailwindcss] Unable to parse at rule`)
      console.warn({ name, params })
      console.warn(err)
    }

    return params
  }

  ast.walk((node: any) => {
    if (node.name === 'plugin' || node.name === 'config' || node.name === 'source') {
      node.params = tryParseAtRuleParams(node.name, node.params)
    }

    if (node.type === 'css-atrule' && node.name === 'apply') {
      let isImportant = /\s+(?:!important|#{(['"]*)!important\1})\s*$/.test(node.params)

      let classList = node.params

      let prefix = ''
      let suffix = ''

      if (classList.startsWith('~"') && classList.endsWith('"')) {
        prefix = '~"'
        suffix = '"'
        classList = classList.slice(2, -1)
        isImportant = false
      } else if (classList.startsWith("~'") && classList.endsWith("'")) {
        prefix = "~'"
        suffix = "'"
        classList = classList.slice(2, -1)
        isImportant = false
      }

      classList = sortClasses(classList, {
        env,
        ignoreLast: isImportant,
        collapseWhitespace: {
          start: false,
          end: !isImportant,
        },
      })

      node.params = `${prefix}${classList}${suffix}`
    }
  })
}

function transformAstro(ast: any, env: TransformerEnv) {
  let { matcher } = env

  if (ast.type === 'element' || ast.type === 'custom-element' || ast.type === 'component') {
    for (let attr of ast.attributes ?? []) {
      if (matcher.hasStaticAttr(attr.name) && attr.type === 'attribute' && attr.kind === 'quoted') {
        attr.value = sortClasses(attr.value, {
          env,
        })
      } else if (
        matcher.hasDynamicAttr(attr.name) &&
        attr.type === 'attribute' &&
        attr.kind === 'expression' &&
        typeof attr.value === 'string'
      ) {
        transformDynamicJsAttribute(attr, env)
      }
    }
  }

  for (let child of ast.children ?? []) {
    transformAstro(child, env)
  }
}

function transformMarko(ast: any, env: TransformerEnv) {
  let { matcher } = env

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
        if (!matcher.hasStaticAttr(currentNode.name)) break
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

function transformTwig(ast: any, env: TransformerEnv) {
  let { matcher } = env

  for (let child of ast.expressions ?? []) {
    transformTwig(child, env)
  }

  visit(ast, {
    Attribute(node, _path, meta) {
      if (!matcher.hasStaticAttr(node.name.name)) return

      meta.sortTextNodes = true
    },

    CallExpression(node, _path, meta) {
      // Traverse property accesses and function calls to find the *trailing* ident
      while (node.type === 'CallExpression' || node.type === 'MemberExpression') {
        if (node.type === 'CallExpression') {
          node = node.callee
        } else if (node.type === 'MemberExpression') {
          // TODO: This is *different* than `isSortableExpression` and that doesn't feel right
          // but they're mutually exclusive implementations
          //
          // This is to handle foo.fnNameHere(…) where `isSortableExpression` is intentionally
          // handling `fnNameHere.foo(…)`.
          node = node.property
        }
      }

      if (node.type === 'Identifier') {
        if (!matcher.hasFunction(node.name)) return
      }

      meta.sortTextNodes = true
    },

    StringLiteral(node, path, meta) {
      if (!meta.sortTextNodes) {
        return
      }

      const concat = path.find((entry) => {
        return (
          entry.parent &&
          (entry.parent.type === 'BinaryConcatExpression' ||
            entry.parent.type === 'BinaryAddExpression')
        )
      })

      node.value = sortClasses(node.value, {
        env,
        ignoreFirst: concat?.key === 'right' && !/^[^\S\r\n]/.test(node.value),
        ignoreLast: concat?.key === 'left' && !/[^\S\r\n]$/.test(node.value),
        collapseWhitespace: {
          start: concat?.key !== 'right',
          end: concat?.key !== 'left',
        },
      })
    },
  })
}

function transformPug(ast: any, env: TransformerEnv) {
  let { matcher } = env

  // This isn't optimal
  // We should merge the classes together across class attributes and class tokens
  // And then we sort them
  // But this is good enough for now

  // First sort the classes in attributes
  for (const token of ast.tokens) {
    if (token.type === 'attribute' && matcher.hasStaticAttr(token.name)) {
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
  let ranges: [number, number][] = []

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
    const classes = ast.tokens.slice(startIdx, endIdx + 1).map((token: any) => token.val)

    const { classList } = sortClassList({
      classList: classes,
      api: env.context,
      removeDuplicates: false,
    })

    for (let i = startIdx; i <= endIdx; i++) {
      ast.tokens[i].val = classList[i - startIdx]
    }
  }
}

function transformSvelte(ast: any, env: TransformerEnv) {
  let { matcher, changes } = env

  for (let attr of ast.attributes ?? []) {
    if (!matcher.hasStaticAttr(attr.name) || attr.type !== 'Attribute') {
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
          removeDuplicates: true,
          collapseWhitespace: false,
        })
        value.data = same
          ? value.raw
          : sortClasses(value.data, {
              env,
              ignoreFirst: i > 0 && !/^\s/.test(value.data),
              ignoreLast: i < attr.value.length - 1 && !/\s$/.test(value.data),
              removeDuplicates: true,
              collapseWhitespace: false,
            })
      } else if (value.type === 'MustacheTag') {
        visit(value.expression, {
          Literal(node) {
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
          TemplateLiteral(node) {
            let before = node.quasis.map((quasi: any) => quasi.value.raw)
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
    transformSvelte(child, env)
  }

  if (ast.type === 'IfBlock') {
    for (let child of ast.else?.children ?? []) {
      transformSvelte(child, env)
    }
  }

  if (ast.type === 'AwaitBlock') {
    let nodes = [ast.pending, ast.then, ast.catch]

    for (let child of nodes) {
      transformSvelte(child, env)
    }
  }

  if (ast.html) {
    transformSvelte(ast.html, env)
  }
}

export { options } from './options.js'

type HtmlNode =
  | { type: 'attribute'; name: string; value: string }
  | { kind: 'attribute'; name: string; value: string }

let html = defineTransform<HtmlNode>({
  staticAttrs: ['class'],

  load: ['prettier/plugins/html'],
  compatible: ['prettier-plugin-organize-attributes'],

  parsers: {
    html: {},
    lwc: {},
    angular: { dynamicAttrs: ['[ngClass]'] },
    vue: { dynamicAttrs: [':class', 'v-bind:class'] },
  },

  transform: transformHtml,
})

type GlimmerNode =
  | { type: 'TextNode'; chars: string }
  | { type: 'StringLiteral'; value: string }
  | { type: 'ConcatStatement'; parts: GlimmerNode[] }
  | { type: 'SubExpression'; path: { original: string } }
  | { type: 'AttrNode'; name: string; value: GlimmerNode }

let glimmer = defineTransform<GlimmerNode>({
  staticAttrs: ['class'],
  load: ['prettier/plugins/glimmer'],

  parsers: {
    glimmer: {},
  },

  transform: transformGlimmer,
})

type CssValueNode = { type: 'value-*'; name: string; params: string }
type CssNode = {
  type: 'css-atrule'
  name: string
  params: string | CssValueNode
}

let css = defineTransform<CssNode>({
  load: ['prettier/plugins/postcss'],
  compatible: ['prettier-plugin-css-order'],

  parsers: {
    css: {},
    scss: {},
    less: {},
  },

  transform: transformCss,
})

let js = defineTransform<import('@babel/types').Node>({
  staticAttrs: ['class', 'className'],
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

  parsers: {
    babel: { load: ['prettier/plugins/babel'] },
    'babel-flow': { load: ['prettier/plugins/babel'] },
    'babel-ts': { load: ['prettier/plugins/babel'] },
    __js_expression: { load: ['prettier/plugins/babel'] },
    typescript: { load: ['prettier/plugins/typescript'] },
    meriyah: { load: ['prettier/plugins/meriyah'] },
    acorn: { load: ['prettier/plugins/acorn'] },
    flow: { load: ['prettier/plugins/flow'] },
    oxc: { load: ['@prettier/plugin-oxc'] },
    'oxc-ts': { load: ['@prettier/plugin-oxc'] },
    hermes: { load: ['@prettier/plugin-hermes'] },
    astroExpressionParser: {
      load: ['prettier-plugin-astro'],
      staticAttrs: ['class'],
      dynamicAttrs: ['class:list'],
    },
  },

  transform: transformJavaScript,
})

type SvelteNode = import('svelte/compiler').AST.SvelteNode & {
  changes: StringChange[]
}

let svelte = defineTransform<SvelteNode>({
  staticAttrs: ['class'],
  load: ['prettier-plugin-svelte'],

  parsers: {
    svelte: {},
  },

  printers: {
    'svelte-ast': {},
  },

  transform: transformSvelte,

  reprint(path, { options, changes }) {
    if (options.__mutatedOriginalText) return
    options.__mutatedOriginalText = true

    if (!changes?.length) return

    let finder = lineColumn(options.originalText)

    let stringChanges: StringChange[] = changes.map((change) => ({
      ...change,
      start: finder.toIndex(change.start.line, change.start.column + 1),
      end: finder.toIndex(change.end.line, change.end.column + 1),
    }))

    options.originalText = spliceChangesIntoString(options.originalText, stringChanges)
  },
})

type AstroNode =
  | { type: 'element'; attributes: Extract<AstroNode, { type: 'attribute' }>[] }
  | {
      type: 'custom-element'
      attributes: Extract<AstroNode, { type: 'attribute' }>[]
    }
  | {
      type: 'component'
      attributes: Extract<AstroNode, { type: 'attribute' }>[]
    }
  | { type: 'attribute'; kind: 'quoted'; name: string; value: string }
  | { type: 'attribute'; kind: 'expression'; name: string; value: unknown }

let astro = defineTransform<AstroNode>({
  staticAttrs: ['class', 'className'],
  dynamicAttrs: ['class:list', 'className'],
  load: ['prettier-plugin-astro'],

  parsers: {
    astro: {},
  },

  transform: transformAstro,
})

type MarkoNode = import('@marko/compiler').types.Node

let marko = defineTransform<MarkoNode>({
  staticAttrs: ['class'],
  load: ['prettier-plugin-marko'],

  parsers: {
    marko: {},
  },

  transform: transformMarko,
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
  load: ['@zackad/prettier-plugin-twig'],

  parsers: {
    twig: {},
  },

  transform: transformTwig,
})

interface PugNode {
  content: string
  tokens: import('pug-lexer').Token[]
}

let pug = defineTransform<PugNode>({
  staticAttrs: ['class'],
  load: ['@prettier/plugin-pug'],

  parsers: {
    pug: {},
  },

  transform: transformPug,
})

type LiquidNode =
  | Liquid.TextNode
  | Liquid.AttributeNode
  | Liquid.LiquidTag
  | Liquid.HtmlElement
  | Liquid.DocumentNode
  | Liquid.LiquidExpression

let liquid = defineTransform<LiquidNode>({
  staticAttrs: ['class'],
  load: ['@shopify/prettier-plugin-liquid'],

  parsers: { 'liquid-html': {} },

  transform: transformLiquid,
})

export const { parsers, printers } = createPlugin([
  //
  html,
  glimmer,
  css,
  js,
  svelte,
  astro,
  marko,
  twig,
  pug,
  liquid,
])

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
   *
   * Default: []
   */
  tailwindFunctions?: string[]

  /**
   * List of custom attributes that contain classes.
   *
   * Default: []
   */
  tailwindAttributes?: string[]

  /**
   * Preserve whitespace around Tailwind classes when sorting.
   *
   * Default: false
   */
  tailwindPreserveWhitespace?: boolean

  /**
   * Preserve duplicate classes inside a class list when sorting.
   *
   * Default: false
   */
  tailwindPreserveDuplicates?: boolean
}
