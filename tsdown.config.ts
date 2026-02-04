import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import type { Plugin } from 'rolldown'
import { defineConfig } from 'tsdown'

/**
 * Patches recast to fix template literal spacing issues.
 * @see https://github.com/benjamn/recast/issues/611
 */
function patchRecast(): Plugin {
  return {
    name: 'patch-recast',
    async load(id) {
      if (!/recast[\\/]lib[\\/]patcher\.js$/.test(id)) {
        return null
      }

      let original = await readFile(id, 'utf8')
      return {
        code: original
          .replace(
            'var nls = needsLeadingSpace(lines, oldNode.loc, newLines);',
            'var nls = oldNode.type !== "TemplateElement" && needsLeadingSpace(lines, oldNode.loc, newLines);',
          )
          .replace(
            'var nts = needsTrailingSpace(lines, oldNode.loc, newLines)',
            'var nts = oldNode.type !== "TemplateElement" && needsTrailingSpace(lines, oldNode.loc, newLines)',
          ),
      }
    },
  }
}

/**
 * Patches jiti to use require for babel import.
 */
function patchJiti(): Plugin {
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
function inlineCssImports(): Plugin {
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
      if (/corePlugins\.js$/.test(id)) {
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
  entry: ['./src/index.ts', './src/lib.ts'],
  outDir: './dist',
  format: 'esm',
  platform: 'node',
  target: 'node14.21.3',
  external: ['prettier'],
  dts: true,
  sourcemap: false,
  fixedExtension: true,
  inlineOnly: false,
  shims: true,
  plugins: [patchRecast(), patchJiti(), inlineCssImports()],
})
