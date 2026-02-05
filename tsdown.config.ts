import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { defineConfig, Rolldown } from 'tsdown'

/**
 * Patches jiti to use require for babel import.
 */
function patchJiti(): Rolldown.Plugin {
  return {
    name: 'patch-jiti',
    async load(id) {
      if (!/jiti[\\/]lib[\\/]jiti\.mjs$/.test(id)) {
        return null
      }

      let original = await readFile(id, 'utf8')
      return {
        code: original.replace(
          'createRequire(import.meta.url)("../dist/babel.cjs")',
          'require("../dist/babel.cjs")',
        ),
      }
    },
  }
}

/**
 * Inlines CSS imports as JavaScript strings.
 */
function inlineCssImports(): Rolldown.Plugin {
  return {
    name: 'inline-css-imports',
    async load(id) {
      // Inline CSS imports
      if (id.endsWith('.css')) {
        let content = await readFile(id, 'utf-8')
        return {
          code: `export default ${JSON.stringify(content)}`,
          moduleType: 'js',
        }
      }

      // Inline preflight in v3
      if (id.endsWith('corePlugins.js')) {
        let preflightPath = path.resolve(path.dirname(id), './css/preflight.css')
        let preflightContent = await readFile(preflightPath, 'utf-8')
        let content = await readFile(id, 'utf-8')

        // This is a bit fragile but this is to inline preflight for the
        // *bundled* version which means a failing test should be enough
        content = content.replace(
          `_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8")`,
          JSON.stringify(preflightContent),
        )

        return {
          code: content,
        }
      }

      return null
    },
  }
}

export default defineConfig({
  entry: ['./src/index.ts', './src/sorter.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node14.21.3',
  external: ['prettier'],
  dts: true,
  sourcemap: false,
  fixedExtension: true,
  minify: 'dce-only',
  inlineOnly: false,
  shims: true,
  plugins: [patchJiti(), inlineCssImports()],
})
