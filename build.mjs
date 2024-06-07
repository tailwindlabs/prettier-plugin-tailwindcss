import * as fs from 'node:fs'
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
      build.onLoad({ filter: /recast\/lib\/patcher\.js$/ }, async (args) => {
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
          `import {fileURLToPath} from 'url'`,

          // CJS interop fixes
          `const require=__global__createRequire__(import.meta.url)`,
          `const __filename=fileURLToPath(import.meta.url)`,
          `const __dirname=__global__dirname__(__filename)`,
        ]

        content = `${code.join('\n')}\n${content}`

        fs.promises.writeFile(outfile, content)
      })
    },
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let context = await esbuild.context({
  bundle: true,
  platform: 'node',
  target: 'node14.21.3',
  external: ['prettier'],
  minify: process.argv.includes('--minify'),
  entryPoints: [path.resolve(__dirname, './src/index.js')],
  outfile: path.resolve(__dirname, './dist/index.mjs'),
  format: 'esm',
  plugins: [patchRecast(), patchCjsInterop()],
})

await context.rebuild()

if (process.argv.includes('--watch')) {
  await context.watch()
}

await context.dispose()
