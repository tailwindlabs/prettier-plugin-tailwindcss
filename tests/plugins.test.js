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
      '@ianvs/prettier-plugin-sort-imports',
    ],
    options: {
      importOrder: ["^@tailwindcss/(.*)$", "^@babel/(.*)$", "^[./]"],
      importOrderSortSpecifiers: true,
    },
    tests: {
      babel: [
        [
          `import './i-haz-side-effects'\nimport i3 from './three'\nimport i2 from '@two/file'\nimport i1 from '@one/file'`,
          `import './i-haz-side-effects'\nimport i1 from '@one/file'\nimport i2 from '@two/file'\nimport i3 from './three'`,
        ],
      ],
      typescript: [
        [
          `import './i-haz-side-effects'\nimport i3 from './three'\nimport i2 from '@two/file'\nimport i1 from '@one/file'`,
          `import './i-haz-side-effects'\nimport i1 from '@one/file'\nimport i2 from '@two/file'\nimport i3 from './three'`,
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
  {
    plugins: [
      'prettier-plugin-twig-melody',
    ],
    options: {
      twigAlwaysBreakObjects: false,
    },
    tests: {
      melody: [
        [
          `<section class="{{ {base:css.prices}|classes }}"></section>`,
          `<section class="{{ { base: css.prices }|classes }}"></section>`,
        ],
        [
          `<section class="sm:p-0 p-4"></section>`,
          `<section class="p-4 sm:p-0"></section>`,
        ],
      ],
    }
  },
  {
    plugins: [
      '@prettier/plugin-pug',
    ],
    tests: {
      pug: [
        [
          `a(class='md:p-4 sm:p-0 p-4 bg-blue-600' href='//example.com') Example`,
          `a.bg-blue-600.p-4(class='sm:p-0 md:p-4', href='//example.com') Example`,
        ],
        [
          `a.p-4.bg-blue-600(class='sm:p-0 md:p-4', href='//example.com') Example`,
          `a.bg-blue-600.p-4(class='sm:p-0 md:p-4', href='//example.com') Example`,
        ],

        // These two tests show how our sorting the two class lists separately is suboptimal
        // Two consecutive saves will result in different output
        // Where the second save is the most correct
        [
          `a.p-4(class='bg-blue-600 sm:p-0 md:p-4', href='//example.com') Example`,
          `a.p-4.bg-blue-600(class='sm:p-0 md:p-4', href='//example.com') Example`,
        ],
        [
          `a.p-4.bg-blue-600(class='sm:p-0 md:p-4', href='//example.com') Example`,
          `a.bg-blue-600.p-4(class='sm:p-0 md:p-4', href='//example.com') Example`,
        ],
      ],
    }
  },
  {
    plugins: [
      '@prettier/plugin-php',
    ],
    tests: {
      php: [
        [
          `<?php $test = function($a,$b){}\n          ?>\n          <div class="sm:p-0 p-4">Example</div>\n          <?php $test = function($c,$d)use($e) {}`,
          `<?php $test = function ($a, $b) {}; ?>\n          <div class="p-4 sm:p-0">Example</div>\n          <?php $test = function ($c, $d) use ($e) {};`
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-import-sort',
    ],
    tests: {
      babel: [
        [
          `
            import './three'
            import '@one/file'
            import '@two/file'
            export default function Foo() { return <div className="sm:p-0 p-4"></div> }
          `,
          `import '@one/file'\nimport '@two/file'\n\nimport './three'\n\nexport default function Foo() {\n  return <div className="p-4 sm:p-0"></div>\n}`,
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-jsdoc',
    ],
    tests: {
      babel: [
        [
          `/**\n             * @param {  string   }    param0 description\n             */\n            export default function Foo(param0) { return <div className="sm:p-0 p-4"></div> }`,
          `/** @param {string} param0 Description */\nexport default function Foo(param0) {\n  return <div className="p-4 sm:p-0"></div>\n}`,
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-css-order',
    ],
    tests: {
      css: [
        [
          `.foo {\n  color: red;\n  background-color: blue;\n  @apply sm:p-0 p-4 bg-blue-600;\n}`,
          `.foo {\n  background-color: blue;\n  color: red;\n  @apply bg-blue-600 p-4 sm:p-0;\n}`,
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-style-order',
    ],
    tests: {
      css: [
        [
          `.foo {\n  color: red;\n  margin-left: 1px;\n  background-color: blue;\n  margin-right: 1px;\n  @apply sm:p-0 p-4 bg-blue-600;\n}`,
          `.foo {\n  margin-right: 1px;\n  margin-left: 1px;\n  color: red;\n  background-color: blue;\n  @apply bg-blue-600 p-4 sm:p-0;\n}`,
        ],
      ],
    }
  },
  {
    plugins: [
      'prettier-plugin-organize-attributes',
    ],
    tests: {
      html: [
        [
          `<a href="https://www.example.com" class="sm:p-0 p-4">Example</a>`,
          `<a class="p-4 sm:p-0" href="https://www.example.com">Example</a>`,
        ],
      ],
    }
  },
  {
    plugins: [
      '@shopify/prettier-plugin-liquid',
    ],
    tests: {
      'liquid-html': [
        [
          `<a class="sm:p-0 p-4" href="https://www.example.com">Example</a>`,
          `<a class='p-4 sm:p-0' href='https://www.example.com'>Example</a>`,
        ],
        [
          `{% if state == true %}\n  <a class="{{ "sm:p-0 p-4" | escape }}" href="https://www.example.com">Example</a>\n{% endif %}`,
          `{% if state == true %}\n  <a class='{{ "p-4 sm:p-0" | escape }}' href='https://www.example.com'>Example</a>\n{% endif %}`,
        ],
        [
          `{%- capture class_ordering -%}<div class="sm:p-0 p-4"></div>{%- endcapture -%}`,
          `{%- capture class_ordering -%}<div class="p-4 sm:p-0"></div>{%- endcapture -%}`,
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
