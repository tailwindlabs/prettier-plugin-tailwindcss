import * as fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

/**
 * @returns {import('esbuild').Plugin}
 */
function patchRecast() {
  return {
    // https://github.com/benjamn/recast/issues/611
    name: 'patch-recast',
    setup(build) {
      build.onLoad({ filter: /recast[\/\\]lib[\/\\]patcher\.js$/ }, async (args) => {
        let original = await fs.promises.readFile(args.path, 'utf8')

        return {
          contents: original
            .replace(
              'var nls = needsLeadingSpace(lines, oldNode.loc, newLines);',
              'var nls = oldNode.type !== "TemplateElement" && needsLeadingSpace(lines, oldNode.loc, newLines);',
            )
            .replace(
              'var nts = needsTrailingSpace(lines, oldNode.loc, newLines)',
              'var nts = oldNode.type !== "TemplateElement" && needsTrailingSpace(lines, oldNode.loc, newLines)',
            ),
        }
      })
    },
  }
}

/**
 * @returns {import('esbuild').Plugin}
 */
function patchJiti() {
  return {
    name: 'patch-jiti',
    setup(build) {
      // TODO: Switch to rolldown and see if we can chunk split this instead?
      build.onLoad({ filter: /jiti[\/\\]lib[\/\\]jiti\.mjs$/ }, async (args) => {
        let original = await fs.promises.readFile(args.path, 'utf8')

        return {
          contents: original.replace(
            'createRequire(import.meta.url)("../dist/babel.cjs")',
            'require("../dist/babel.cjs")',
          ),
        }
      })
    },
  }
}

/**
 * @returns {import('esbuild').Plugin}
 */
function patchCjsInterop() {
  return {
    name: 'patch-cjs-interop',
    setup(build) {
      build.onEnd(async () => {
        let outfile = './dist/index.mjs'

        let content = await fs.promises.readFile(outfile)

        // Prepend `createRequire`
        let code = [
          `import {createRequire as __global__createRequire__} from 'module'`,
          `import {dirname as __global__dirname__} from 'path'`,
          `import {fileURLToPath as __global__fileURLToPath__} from 'url'`,

          // CJS interop fixes
          `const require=__global__createRequire__(import.meta.url)`,
          `const __filename=__global__fileURLToPath__(import.meta.url)`,
          `const __dirname=__global__dirname__(__filename)`,
        ]

        content = `${code.join('\n')}\n${content}`

        fs.promises.writeFile(outfile, content)
      })
    },
  }
}

/**
 * @returns {import('esbuild').Plugin}
 */
function inlineCssImports() {
  return {
    name: 'inline-css-imports',
    setup(build) {
      // Inline CSS imports
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let content = await readFile(args.path, 'utf-8')

        return {
          loader: 'js',
          contents: `export default ${JSON.stringify(content)}`,
        }
      })

      // Inline preflight in v3
      // TODO: This needs a test
      build.onLoad({ filter: /corePlugins\.js$/ }, async (args) => {
        let preflightPath = path.resolve(path.dirname(args.path), './css/preflight.css')
        let preflightContent = await readFile(preflightPath, 'utf-8')

        let content = await readFile(args.path, 'utf-8')

        // This is a bit fragile but this is to inline preflight for the
        // *bundled* version which means a failing test should be enough
        content = content.replace(
          `_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8")`,
          JSON.stringify(preflightContent),
        )

        return {
          loader: 'js',
          contents: content,
        }
      })
    },
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let context = await esbuild.context({
  bundle: true,
  platform: 'node',
  target: 'node14.21.3',
  external: ['prettier', 'oxc-resolver'],
  minify: process.argv.includes('--minify'),
  entryPoints: [path.resolve(__dirname, './src/index.js')],
  outfile: path.resolve(__dirname, './dist/index.mjs'),
  format: 'esm',
  plugins: [patchRecast(), patchJiti(), patchCjsInterop(), inlineCssImports()],
})

await context.rebuild()

if (process.argv.includes('--watch')) {
  await context.watch()
}

await context.dispose()
