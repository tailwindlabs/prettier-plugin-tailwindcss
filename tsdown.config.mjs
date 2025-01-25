import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { bundleStats } from 'rollup-plugin-bundle-stats'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',

  format: 'esm',
  platform: 'node',
  shims: true,
  minify: true,
  hash: false,
  fixedExtension: true,

  external: [/^prettier(\/.+)?$/, 'sugarss'],
  loader: { '.css': 'text' },

  // outputOptions: {
  //   advancedChunks: {
  //     groups: [
  //       { name: 'assets', test: /\.css$/ },
  //       { name: 'compilers', test: /node_modules\/(jiti|sucrase)\/.*/ },
  //       { name: 'v4', test: /tailwindcss-v4\/.*/ },
  //       { name: 'v3', test: /tailwindcss-v3\/.*/ },
  //       { name: 'deps', test: /node_modules\/.*/ },
  //     ],
  //   },
  // },

  plugins: [
    {
      name: 'patch-recast',
      transform: {
        filter: { id: /recast\/lib\/patcher\.js$/ },
        handler: (code) => ({
          code: code
            .replace(
              'var nls = needsLeadingSpace(lines, oldNode.loc, newLines);',
              'var nls = oldNode.type !== "TemplateElement" && needsLeadingSpace(lines, oldNode.loc, newLines);',
            )
            .replace(
              'var nts = needsTrailingSpace(lines, oldNode.loc, newLines)',
              'var nts = oldNode.type !== "TemplateElement" && needsTrailingSpace(lines, oldNode.loc, newLines)',
            ),
        }),
      },
    },
    {
      name: 'inline-preflight-v3',
      transform: {
        filter: { id: /corePlugins\.js$/ },
        async handler(code, id) {
          let preflightPath = path.resolve(path.dirname(id), './css/preflight.css')
          let preflightContent = await fs.readFile(preflightPath, 'utf-8')

          // This is a bit fragile but this is to inline preflight for the
          // *bundled* version which means a failing test should be enough
          code = code.replace(
            `_fs.default.readFileSync(_path.join(__dirname, "./css/preflight.css"), "utf8")`,
            JSON.stringify(preflightContent),
          )

          return { code }
        },
      },
    },
    // TODO: We already chunk split babel but it's not lazy loaded right now
    // Can we find a way to lazy load it without await import(…) or similar?
    // I don't think the function this is in can be async
    {
      name: 'patch-jiti',
      transform: {
        filter: { id: /jiti\/lib\/jiti\.mjs$/ },
        handler: (code) => ({
          code: code.replace('createRequire(import.meta.url)("../dist/babel.cjs")', 'require("../dist/babel.cjs")'),
        }),
      },
    },
  ],
})
