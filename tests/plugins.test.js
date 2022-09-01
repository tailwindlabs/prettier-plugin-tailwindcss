const prettier = require('prettier')
const path = require('path')

function format(str, options = {}) {
  return prettier
    .format(str, {
      pluginSearchDirs: [__dirname], // disable plugin autoload
      plugins: [
        path.resolve(__dirname, '..'),
      ],
      semi: false,
      singleQuote: true,
      printWidth: 9999,
      parser: 'html',
      ...options,
    })
    .trim()
}


let tests = [
  {
    plugins: [
      '@trivago/prettier-plugin-sort-imports',
    ],
    options: {
      importOrder: ["^@one/(.*)$", "^@two/(.*)$", "^[./]"],
      importOrderSortSpecifiers: true,
    },
    tests: {
      babel: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import '@one/file'\nimport '@two/file'\nimport './three'`,
        ],
      ],
      typescript: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import '@one/file'\nimport '@two/file'\nimport './three'`,
        ],
      ],

      // This plugin does not support babel-ts
      'babel-ts': [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-organize-imports',
    ],
    options: {},
    tests: {
      babel: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import '@one/file'\nimport '@two/file'\nimport './three'`,
        ],
      ],
      typescript: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import '@one/file'\nimport '@two/file'\nimport './three'`,
        ],
      ],
      'babel-ts': [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import '@one/file'\nimport '@two/file'\nimport './three'`,
        ],
      ],
    }
  },
]

for (const group of tests) {
  let name = group.plugins.join(', ')

  for (let parser in group.tests) {
    test(`parsing ${parser} works with: ${name}`, () => {
      let plugins = [
        ...group.plugins.map(name => require.resolve(name)),
        path.resolve(__dirname, '..'),
      ]

      for (const [input, expected] of group.tests[parser]) {
        expect(format(input, { parser, plugins, ...group.options })).toEqual(expected)
      }
    })
  }
}
