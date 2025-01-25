import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  platform: 'node',
  external: [/^prettier(\/.+)?$/, 'sugarss'],

  plugins: [
    {
      name: 'patch-recast',
      filter: /recast\/lib\/patcher\.js$/,
      transform: (code) => {
        code = code.replace(
          'var nls = needsLeadingSpace(lines, oldNode.loc, newLines);',
          'var nls = oldNode.type !== "TemplateElement" && needsLeadingSpace(lines, oldNode.loc, newLines);',
        )

        code = code.replace(
          'var nts = needsTrailingSpace(lines, oldNode.loc, newLines)',
          'var nts = oldNode.type !== "TemplateElement" && needsTrailingSpace(lines, oldNode.loc, newLines)',
        )
      },
    },
  ],

  output: {
    format: 'esm',
    dir: 'dist',
    target: 'es2022',
    entryFileNames: '[name].mjs',
    // chunkFileNames: '[name].mjs',

    // advancedChunks: {
    //   groups: [
    //     {
    //       name: 'tw',
    //       test: /tailwindcss\/(lib|types)\/.*/,
    //     },
    //     {
    //       name: 'tw',
    //       test: /tailwindcss\/(loadConfig|resolveConfig)/,
    //     },
    //   ],
    // },

    plugins: [
      {
        name: 'patch-cjs-interop',

        generateBundle(_, bundle) {
          let output = bundle['index.mjs']
          if (!output) return

          return

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

          output.code = `${code.join('\n')}\n${output.code}`
        },
      },
    ],
  },
})
