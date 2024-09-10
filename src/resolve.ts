import { createRequire as req } from 'node:module'
import resolveFrom from 'resolve-from'
import { expiringMap } from './expiring-map'

const localRequire = req(import.meta.url)

// This is a long-lived cache for resolved modules whether they exist or not
// Because we're compatible with a large number of plugins, we need to check
// for the existence of a module before attempting to import it. This cache
// is used to mitigate the cost of that check because Node.js does not cache
// failed module resolutions making repeated checks very expensive.
const resolveCache = expiringMap<string, string | null>(30_000)

export function resolveIn(id: string, paths: string[]) {
  return localRequire.resolve(id, {
    paths,
  })
}

export function maybeResolve(name: string) {
  let modpath = resolveCache.get(name)

  if (modpath === undefined) {
    modpath = freshMaybeResolve(name)
    resolveCache.set(name, modpath)
  }

  return modpath
}

export async function loadIfExists<T>(name: string): Promise<T | null> {
  let modpath = maybeResolve(name)

  if (modpath) {
    let mod = await import(name)
    return mod.default ?? mod
  }

  return null
}

function freshMaybeResolve(name: string) {
  try {
    return localRequire.resolve(name)
  } catch (err) {
    return null
  }
}

export { resolveFrom }
