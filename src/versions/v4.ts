import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createJiti, type Jiti } from 'jiti'
import * as v4 from 'tailwindcss-v4'
import { resolveCssFrom, resolveJsFrom } from '../resolve'
import type { UnifiedApi } from '../types'
import { assets } from './assets'

interface DesignSystem {
  getClassOrder(classList: string[]): [string, bigint | null][]
}

interface LoadOptions {
  base: string

  loadModule?(
    id: string,
    base: string,
    resourceType: string,
  ): Promise<{
    base: string
    module: unknown
  }>

  loadPlugin?(id: string, base: string, resourceType: string): Promise<unknown>
  loadConfig?(id: string, base: string, resourceType: string): Promise<unknown>

  loadStylesheet?(
    id: string,
    base: string,
  ): Promise<{
    base: string
    content: string
  }>
}

interface ApiV4 {
  __unstable__loadDesignSystem(css: string, options: LoadOptions): Promise<DesignSystem>
}

export async function loadV4(mod: ApiV4 | null, stylesheet: string | null): Promise<UnifiedApi> {
  // This is not Tailwind v4
  let isFallback = false
  if (!mod || !mod.__unstable__loadDesignSystem) {
    mod = v4 as ApiV4
    isFallback = true
  }

  // Create a Jiti instance that can be used to load plugins and config files
  let jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
  })

  let css: string
  let importBasePath: string

  if (stylesheet) {
    // Resolve imports in the entrypoint to a flat CSS tree
    css = await fs.readFile(stylesheet, 'utf-8')
    importBasePath = path.dirname(stylesheet)
  } else {
    importBasePath = process.cwd()
    stylesheet = path.join(importBasePath, 'fake.css')
    css = assets['tailwindcss/theme.css']
  }

  // Load the design system and set up a compatible context object that is
  // usable by the rest of the plugin
  let design = await mod.__unstable__loadDesignSystem(css, {
    base: importBasePath,

    // v4.0.0-alpha.25+
    loadModule: createLoader({
      legacy: false,
      jiti,
      filepath: stylesheet,
      onError: (id, err, resourceType) => {
        console.error(`Unable to load ${resourceType}: ${id}`, err)

        if (resourceType === 'config') {
          return {}
        } else if (resourceType === 'plugin') {
          return () => {}
        }
      },
    }),

    loadStylesheet: async (id: string, base: string) => {
      try {
        let resolved = resolveCssFrom(base, id)

        return {
          base: path.dirname(resolved),
          content: await fs.readFile(resolved, 'utf-8'),
        }
      } catch (err) {
        if (isFallback && id in assets) {
          return { base, content: assets[id] }
        }

        throw err
      }
    },

    // v4.0.0-alpha.24 and below
    loadPlugin: createLoader({
      legacy: true,
      jiti,
      filepath: stylesheet,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      legacy: true,
      jiti,
      filepath: stylesheet,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  return {
    getClassOrder: (classList: string[]) => {
      return design.getClassOrder(classList)
    },
  }
}

function createLoader<T>({
  legacy,
  jiti,
  filepath,
  onError,
}: {
  legacy: true
  jiti: Jiti
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}): (id: string) => Promise<unknown>

function createLoader<T>({
  legacy,
  jiti,
  filepath,
  onError,
}: {
  legacy: false
  jiti: Jiti
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}): (
  id: string,
  base: string,
  resourceType: string,
) => Promise<{
  base: string
  module: unknown
}>

/**
 * Create a loader function that can load plugins and config files relative to
 * the CSS file that uses them. However, we don't want missing files to prevent
 * everything from working so we'll let the error handler decide how to proceed.
 */
function createLoader<T>({
  legacy,
  jiti,
  filepath,
  onError,
}: {
  legacy: boolean
  jiti: Jiti
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = resolveJsFrom(base, id)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await jiti.import(url.href, { default: true })
    } catch (err) {
      return onError(id, err, resourceType)
    }
  }

  if (legacy) {
    let baseDir = path.dirname(filepath)
    return (id: string) => loadFile(id, baseDir, 'module')
  }

  return async (id: string, base: string, resourceType: string) => {
    return {
      base,
      module: await loadFile(id, base, resourceType),
    }
  }
}
