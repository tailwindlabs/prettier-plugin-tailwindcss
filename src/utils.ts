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

// https://lihautan.com/manipulating-ast-with-javascript/
export function visit(ast: any, callbackMap: any) {
  function _visit(
    node: any,
    parent?: any,
    key?: any,
    index?: any,
    meta: Record<string, unknown> = {},
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
