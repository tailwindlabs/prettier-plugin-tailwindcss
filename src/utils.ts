import type { StringChange } from './types'

// For loading prettier plugins only if they exist
export function loadIfExists(name: string): any {
  try {
    if (require.resolve(name)) {
      return require(name)
    }
  } catch (e) {
    return null
  }
}

type Visitor<T, Meta extends Record<string, unknown>> = (
  node: T,
  parent: T,
  key: string | undefined,
  index: number | undefined,
  meta: Partial<Meta>,
) => void | false

type Visitors<T, Meta extends Record<string, unknown>> = Record<
  string,
  Visitor<T, Meta>
>

// https://lihautan.com/manipulating-ast-with-javascript/
export function visit<T extends {}, Meta extends Record<string, unknown>>(
  ast: T,
  callbackMap: Visitors<T, Meta> | Visitor<T, Meta>,
) {
  function _visit(
    node: any,
    parent: any,
    key: string | undefined,
    index: number | undefined,
    meta: Meta,
  ) {
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
            let newMeta = { ...meta }

            _visit(child[j], node, keys[i], j, newMeta)
          }
        }
      } else if (typeof child?.type === 'string') {
        let newMeta = { ...meta }

        _visit(child, node, keys[i], i, newMeta)
      }
    }
  }

  let newMeta: Meta = {} as any

  _visit(ast, null, undefined, undefined, newMeta)
}

/**
 * Apply the changes to the string such that a change in the length
 * of the string does not break the indexes of the subsequent changes.
 */
export function spliceChangesIntoString(str: string, changes: StringChange[]) {
  // Sort all changes in reverse order so we apply them from the end of the string
  // to the beginning. This way, the indexes for the changes after the current one
  // will still be correct after applying the current one.
  changes.sort((a, b) => {
    return b.end - a.end || b.start - a.start
  })

  // Splice in each change to the string
  for (let change of changes) {
    str = str.slice(0, change.start) + change.after + str.slice(change.end)
  }

  return str
}
