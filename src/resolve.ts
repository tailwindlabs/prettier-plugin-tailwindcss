import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve'
import { expiringMap } from './expiring-map'

const fileSystem = new CachedInputFileSystem(fs, 30_000)

const esmResolver = ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: ['.mjs', '.js'],
  mainFields: ['module'],
  conditionNames: ['node', 'import'],
})

const cjsResolver = ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: ['.js', '.cjs'],
  mainFields: ['main'],
  conditionNames: ['node', 'require'],
})

const cssResolver = ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: ['.css'],
  mainFields: ['style'],
  conditionNames: ['style'],
})

// This is a long-lived cache for resolved modules whether they exist or not
// Because we're compatible with a large number of plugins, we need to check
// for the existence of a module before attempting to import it. This cache
// is used to mitigate the cost of that check because Node.js does not cache
// failed module resolutions making repeated checks very expensive.
const resolveCache = expiringMap<string, string | null>(30_000)

export function maybeResolve(name: string) {
  let modpath = resolveCache.get(name)

  if (modpath === undefined) {
    try {
      modpath = resolveJsFrom(fileURLToPath(import.meta.url), name)
      resolveCache.set(name, modpath)
    } catch (err) {
      resolveCache.set(name, null)
      return null
    }
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

export function resolveJsFrom(base: string, id: string): string {
  try {
    return esmResolver.resolveSync({}, base, id) || id
  } catch (err) {
    return cjsResolver.resolveSync({}, base, id) || id
  }
}

export function resolveCssFrom(base: string, id: string) {
  return cssResolver.resolveSync({}, base, id) || id
}
