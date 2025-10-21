import type { AstPath } from 'prettier'

type Branch<T> = { node: T; key: string | null; index: number | null; parent: Branch<T> | null }

export function takenBranches<T>(path: AstPath<T>) {
  let branches: Branch<T>[] = [{ node: path.node, key: path.key, index: path.index, parent: null }]

  for (let i = 0; i < path.ancestors.length; ++i) {
    branches.push(path.callParent((p) => ({ node: p.node, key: p.key, index: p.index, parent: null }), i))
  }

  for (let i = 0; i < branches.length; ++i) {
    branches[i].parent = branches[i + 1] ?? null
  }

  return branches
}
