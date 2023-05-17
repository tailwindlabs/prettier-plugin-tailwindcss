const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

esbuild.build({
  entryPoints: [path.resolve(__dirname, './src/index.js')],
  outfile: path.resolve(__dirname, './dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node12.13.0',
  external: ['prettier'],
  minify: process.argv.includes('--minify'),
  watch: process.argv.includes('--watch'),
  plugins: [
    {
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
    },
    {
      name: 'copy-types',
      setup(build) {
        build.onEnd(() =>
          fs.promises.copyFile(
            path.resolve(__dirname, './src/index.d.ts'),
            path.resolve(__dirname, './dist/index.d.ts'),
          ),
        )
      },
    },
  ],
})
