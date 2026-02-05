import * as path from 'node:path'
import type { StringChange } from './types'

// For loading prettier plugins only if they exist
export function loadIfExists(name: string): any {
  try {
    if (require.resolve(name)) {
      return require(name)
    }
  } catch {
    return null
  }
}

interface PathEntry<T, Meta> {
  node: T
  parent: T | null
  key: string | null
  index: number | null
  meta: Meta
}

export type Path<T, Meta> = PathEntry<T, Meta>[]

type Visitor<T, Meta extends Record<string, unknown>> = (
  node: T,
  path: Path<T, Meta>,
  meta: Partial<Meta>,
) => void | false

type Visitors<T, Meta extends Record<string, unknown>> = Record<string, Visitor<T, Meta>>

function isNodeLike(value: any): value is { type: string } {
  return typeof value?.type === 'string'
}

// https://lihautan.com/manipulating-ast-with-javascript/
export function visit<T extends {}, Meta extends Record<string, unknown>>(
  ast: T,
  callbackMap: Visitors<T, Meta> | Visitor<T, Meta>,
) {
  function _visit(node: any, path: Path<T, Meta>, meta: Meta) {
    if (typeof callbackMap === 'function') {
      if (callbackMap(node, path, meta) === false) {
        return
      }
    } else if (node.type in callbackMap) {
      if (callbackMap[node.type](node, path, meta) === false) {
        return
      }
    }

    const keys = Object.keys(node)
    for (let i = 0; i < keys.length; i++) {
      const child = node[keys[i]]
      if (Array.isArray(child)) {
        for (let j = 0; j < child.length; j++) {
          if (isNodeLike(child[j])) {
            let newMeta = { ...meta }
            let newPath = [
              {
                node: child[j],
                parent: node,
                key: keys[i],
                index: j,
                meta: newMeta,
              },
              ...path,
            ]

            _visit(child[j], newPath, newMeta)
          }
        }
      } else if (isNodeLike(child)) {
        let newMeta = { ...meta }
        let newPath = [
          {
            node: child,
            parent: node,
            key: keys[i],
            index: i,
            meta: newMeta,
          },
          ...path,
        ]

        _visit(child, newPath, newMeta)
      }
    }
  }

  let newMeta: Meta = {} as any
  let newPath: Path<T, Meta> = [
    {
      node: ast,
      parent: null,
      key: null,
      index: null,
      meta: newMeta,
    },
  ]

  _visit(ast, newPath, newMeta)
}

/**
 * Apply the changes to the string such that a change in the length
 * of the string does not break the indexes of the subsequent changes.
 */
export function spliceChangesIntoString(str: string, changes: StringChange[]) {
  // If there are no changes, return the original string
  if (!changes[0]) return str

  // Sort all changes in order to make it easier to apply them
  changes.sort((a, b) => {
    return a.end - b.end || a.start - b.start
  })

  // Append original string between each chunk, and then the chunk itself
  // This is sort of a String Builder pattern, thus creating less memory pressure
  let result = ''

  let previous = changes[0]

  result += str.slice(0, previous.start)
  result += previous.after

  for (let i = 1; i < changes.length; ++i) {
    let change = changes[i]

    result += str.slice(previous.end, change.start)
    result += change.after

    previous = change
  }

  // Add leftover string from last chunk to end
  result += str.slice(previous.end)

  return result
}

export function bigSign(bigIntValue: bigint) {
  return Number(bigIntValue > 0n) - Number(bigIntValue < 0n)
}

/**
 * Cache a value for all directories from `inputDir` up to `targetDir` (inclusive).
 * Stops early if an existing cache entry is found.
 *
 * How it works:
 *
 * For a file at '/repo/packages/ui/src/Button.tsx' with config at '/repo/package.json'
 *
 * `cacheForDirs(cache, '/repo/packages/ui/src', '/repo/package.json', '/repo')`
 *
 * Caches:
 * - '/repo/packages/ui/src' -> '/repo/package.json'
 * - '/repo/packages/ui'     -> '/repo/package.json'
 * - '/repo/packages'        -> '/repo/package.json'
 * - '/repo'                 -> '/repo/package.json'
 */
export function cacheForDirs<V>(
  cache: { set(key: string, value: V): void; get(key: string): V | undefined },
  inputDir: string,
  value: V,
  targetDir: string,
  makeKey: (dir: string) => string = (dir) => dir,
): void {
  let dir = inputDir
  while (dir !== path.dirname(dir) && dir.length >= targetDir.length) {
    const key = makeKey(dir)
    // Stop caching if we hit an existing entry
    if (cache.get(key) !== undefined) break

    cache.set(key, value)
    if (dir === targetDir) break
    dir = path.dirname(dir)
  }
}
