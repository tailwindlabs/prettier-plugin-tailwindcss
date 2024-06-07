import { readFile, writeFile } from 'fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  target: 'node18',
  format: ['esm'],
  dts: { only: true },
  outExtension: () => ({ js: '.mjs' }),

  platform: 'node',
  external: ['prettier', 'fs'],
  minify: process.argv.includes('--minify'),

  esbuildPlugins: [
    // Patch Recast to fix a bug with leading/trailing spaces in template literals
    {
      // https://github.com/benjamn/recast/issues/611
      name: 'patch-recast',
      setup(build) {
        build.onLoad({ filter: /recast\/lib\/patcher\.js$/ }, async (args) => {
          let original = await readFile(args.path, 'utf8')

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
    },

    // Prepend some CJS interop helpers
    {
      name: 'patch-cjs-interop',
      setup(build) {
        build.onEnd(async () => {
          return
          let outfile = './dist/index.mjs'

          let content = await readFile(outfile, 'utf-8')

          // Prepend `createRequire`
          let code = [
            `import {createRequire} from 'module'`,
            `import {dirname as __global__dirname__} from 'path'`,
            `import {fileURLToPath} from 'url'`,

            // CJS interop fixes
            `const require=createRequire(import.meta.url)`,
            `const __filename=fileURLToPath(import.meta.url)`,
            `const __dirname=__global__dirname__(__filename)`,
          ]

          content = `${code.join('\n')}\n${content}`

          writeFile(outfile, content, 'utf-8')
        })
      },
    },
  ],
})
