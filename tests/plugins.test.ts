import { createRequire } from 'node:module'
import dedent from 'dedent'
import { test } from 'vitest'
import { javascript } from './tests.js'
import type { TestEntry } from './utils.js'
import { format, no, pluginPath, t, yes } from './utils.js'

const require = createRequire(import.meta.url)

interface PluginTest {
  plugins: string[]
  options?: Record<string, any>
  tests: Record<string, TestEntry[]>
}

let tests: PluginTest[] = [
  {
    plugins: ['@trivago/prettier-plugin-sort-imports'],
    options: {
      importOrder: ['^@one/(.*)$', '^@two/(.*)$', '^[./]'],
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
    },
  },
  {
    plugins: ['@ianvs/prettier-plugin-sort-imports'],
    options: {
      importOrder: ['^@tailwindcss/(.*)$', '^@babel/(.*)$', '^[./]'],
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
    },
  },
  {
    plugins: ['prettier-plugin-sort-imports'],
    options: {
      sortingMethod: 'alphabetical',
    },
    tests: {
      babel: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import './three'\nimport '@one/file'\nimport '@two/file'`,
        ],
      ],
      typescript: [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import './three'\nimport '@one/file'\nimport '@two/file'`,
        ],
      ],

      // This plugin does not support babel-ts
      'babel-ts': [
        [
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
          `import './three'\nimport '@two/file'\nimport '@one/file'`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-multiline-arrays'],
    tests: {
      babel: [[`const array = [\n'one']`, `const array = [\n  'one',\n]`]],
      typescript: [[`const array = [\n'one']`, `const array = [\n  'one',\n]`]],
      'babel-ts': [[`const array = [\n'one']`, `const array = [\n  'one',\n]`]],
    },
  },
  {
    plugins: ['prettier-plugin-organize-imports'],
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
    },
  },
  {
    plugins: ['@zackad/prettier-plugin-twig'],
    options: {
      twigAlwaysBreakObjects: false,
    },
    tests: {
      twig: [
        [
          `<section class="{{ {base:css.prices}|classes }}"></section>`,
          `<section class="{{ { base: css.prices }|classes }}"></section>`,
        ],
        t`<section class="${yes}"></section>`,

        t`<section class="${yes} text-{{ i }}"></section>`,
        t`<section class="${yes} {{ i }}-text"></section>`,
        t`<section class="text-{{ i }} ${yes}"></section>`,
        t`<section class="{{ i }}-text ${yes}"></section>`,

        // text-center is used because it's placed between p-0 and sm:p-0
        t`<section class="${yes} text-center{{ i }}"></section>`,
        t`<section class="${yes} {{ i }}text-center"></section>`,
        t`<section class="text-center{{ i }} ${yes}"></section>`,
        t`<section class="{{ i }}text-center ${yes}"></section>`,

        [
          `<div class=" sm:flex   underline  block"></div>`,
          `<div class="block underline sm:flex"></div>`,
        ],
        [
          `<div class="{{ ' flex ' + ' underline ' + ' block ' }}"></div>`,
          `<div class="{{ 'flex ' + ' underline' + ' block' }}"></div>`,
        ],
      ],
    },
  },
  {
    plugins: ['@prettier/plugin-hermes'],
    tests: {
      hermes: javascript,
    },
  },
  {
    plugins: ['@prettier/plugin-oxc'],
    tests: {
      oxc: javascript,
      'oxc-ts': javascript,
    },
  },
  {
    plugins: ['@prettier/plugin-pug'],
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

        [
          `a.p-4.bg-blue-600(class=' sm:p-0     md:p-4 ', href='//example.com') Example`,
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
    },
  },
  {
    plugins: ['prettier-plugin-jsdoc'],
    tests: {
      babel: [
        [
          `/**\n             * @param {  string   }    param0 description\n             */\n            export default function Foo(param0) { return <div className="sm:p-0 p-4"></div> }`,
          `/** @param {string} param0 Description */\nexport default function Foo(param0) {\n  return <div className="p-4 sm:p-0"></div>\n}`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-css-order'],
    tests: {
      css: [
        [
          `.foo {\n  color: red;\n  background-color: blue;\n  @apply sm:p-0 p-4 bg-blue-600;\n}`,
          `.foo {\n  background-color: blue;\n  color: red;\n  @apply bg-blue-600 p-4 sm:p-0;\n}`,
        ],
      ],
    },
  },
  {
    // NOTE: This plugin doesn't officially support Prettier v3 but it appears to work
    plugins: ['prettier-plugin-style-order'],
    tests: {
      css: [
        [
          `.foo {\n  color: red;\n  margin-left: 1px;\n  background-color: blue;\n  margin-right: 1px;\n  @apply sm:p-0 p-4 bg-blue-600;\n}`,
          `.foo {\n  margin-right: 1px;\n  margin-left: 1px;\n  color: red;\n  background-color: blue;\n  @apply bg-blue-600 p-4 sm:p-0;\n}`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-organize-attributes'],
    tests: {
      html: [
        [
          `<a href="https://www.example.com" class="sm:p-0 p-4">Example</a>`,
          `<a class="p-4 sm:p-0" href="https://www.example.com">Example</a>`,
        ],
      ],
    },
  },
  {
    plugins: ['@shopify/prettier-plugin-liquid'],
    tests: {
      'liquid-html': [
        t`<a class='${yes}' href='https://www.example.com'>Example</a>`,
        t`{% if state == true %}\n  <a class='{{ "${yes}" | escape }}' href='https://www.example.com'>Example</a>\n{% endif %}`,
        t`{%- capture class_ordering -%}<div class="${yes}"></div>{%- endcapture -%}`,
        t`{%- capture class_ordering -%}<div class="foo1 ${yes}"></div><div class="foo2 ${yes}"></div>{%- endcapture -%}`,
        t`{%- capture class_ordering -%}<div class="foo1 ${yes}"><div class="foo2 ${yes}"></div></div>{%- endcapture -%}`,
        t`<p class='${yes} {{ some.prop | prepend: 'is-' }} '></p>`,
        t`<div class='${yes} {% render 'some-snippet', settings: section.settings %}'></div>`,
        t`<div class='${yes} {{ foo }}'></div>`,
        t`<div class='${yes} {% render 'foo' %}'></div>`,
        t`<div class='${yes} {% render 'foo', bar: true %}'></div>`,
        t`<div class='${yes} {% include 'foo' %}'></div>`,
        t`<div class='${yes} {% include 'foo', bar: true %}'></div>`,
        t`<div class='${yes} foo--{{ id }}'></div>`,
        t`<div class='${yes} {{ id }}'></div>`,

        // Whitespace removal is disabled for Liquid
        // due to the way Liquid prints the AST
        // (the length of the output MUST NOT change)
        [
          `<div class=' sm:flex   underline  block'></div>`,
          `<div class=' block   underline  sm:flex'></div>`,
        ],
        [
          `<div class='{{ ' flex ' + ' underline ' + ' block ' }}'></div>`,
          `<div class='{{ ' flex ' + ' underline ' + ' block ' }}'></div>`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-marko'],
    tests: {
      marko: [
        t`<div class='${yes}'/>`,
        t`<!-- <div class='${no}'/> -->`,
        t`<div not-class='${no}'/>`,
        t`<div class/>`,
        t`<div class=''/>`,
        t`<div>
  <h1 class='${yes}'/>
</div>`,
        t`style {
  h1 {
    @apply ${yes};
  }
}`,
        t`<div class=[
  '${yes}',
  'w-full',
  someVariable,
  {
    a: true,
  },
  null,
  '${yes}',
]/>`,
        t`<div class=['${yes}', 'underline', someVariable]/>`,

        [
          `<div class=' sm:flex   underline  block'/>`,
          `<div class='block underline sm:flex'/>`,
        ],

        // TODO: An improvement to the plugin would be to remove the whitespace
        // in this scenario:
        [
          `<div class=[' flex ' + ' underline ' + ' block ']/>`,
          `<div class=[' flex ' + ' underline ' + ' block ']/>`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-astro'],
    tests: {
      astro: [
        // ...html, // TODO:
        [
          `{<div class="p-20 bg-red-100 w-full"></div>}`,
          `{(<div class="w-full bg-red-100 p-20" />)}`,
        ],
        [
          `<style>
  h1 {
    @apply bg-fuchsia-50 p-20 w-full;
}
</style>`,
          `<style>
  h1 {
    @apply w-full bg-fuchsia-50 p-20;
  }
</style>`,
        ],
        t`---
import Layout from '../layouts/Layout.astro'
import Custom from '../components/Custom.astro'
---

<Layout>
  <main class="${yes}"></main>
  <my-element class="${yes}"></my-element>
  <Custom class="${yes}" />
</Layout>`,
        t`<div>
  <span class:list={['${yes}', { '${yes}': '${yes}' }, new Set(['${yes}'])]}></span>
</div>`,
        t`<div>
  <span class:list={[\`${yes}\`, \`\${'${yes}'}\`, \`\${\`${yes}\`}\`, \`\${\`\${'${yes}'}\`}\`]}></span>
</div>`,
        t`<MyReactComponent className="${yes}" />`,
        t`<MyReactComponent className={'${yes}'} />`,

        [
          `<div class=" sm:flex   underline  block"></div>`,
          `<div class="block underline sm:flex"></div>`,
        ],
        [
          `<div class:list={[' flex ' + ' underline ' + ' block ']}></div>`,
          `<div class:list={['flex ' + ' underline' + ' block']}></div>`,
        ],
      ],
    },
  },
  {
    plugins: ['prettier-plugin-svelte'],
    tests: {
      svelte: [
        t`<div class="${yes}" />`,
        t`<div class />`,
        t`<div class="" />`,
        t`<div class="${yes} {someVar}" />`,
        t`<div class="{someVar} ${yes}" />`,
        t`<div class="${yes} {someVar} ${yes}" />`,
        t`<div class={'${yes}'} />`,
        t`<div class={'${yes}' + '${yes}'} />`,
        t`<div class={\`${yes}\`} />`,
        t`<div class={\`${yes} \${'${yes}' + \`${yes}\`} ${yes}\`} />`,
        t`<div class={\`${no}\${someVar}${no}\`} />`,
        t`<div class="${yes} {\`${yes}\`}" />`,
        t`<div let:class={clazz} class="${yes} {clazz}" />`,
        t`{#if something} <div class="${yes}" /> {:else} <div class="${yes}" /> {/if}`,
        [
          `<div class="sm:block uppercase flex{someVar}" />`,
          `<div class="uppercase sm:block flex{someVar}" />`,
        ],
        [
          `<div class="{someVar}sm:block md:inline flex" />`,
          `<div class="{someVar}sm:block flex md:inline" />`,
        ],
        [
          `<div class="sm:p-0 p-0 {someVar}sm:block md:inline flex" />`,
          `<div class="p-0 sm:p-0 {someVar}sm:block flex md:inline" />`,
        ],
        t`{#await promise()} <div class="${yes}" /> {:then} <div class="${yes}" /> {/await}`,
        t`{#await promise() then} <div class="${yes}" /> {/await}`,

        // Whitespace removal is applied by Svelte itself
        [
          `<div class=" sm:flex   underline  block"></div>`,
          `<div class=" block underline sm:flex"></div>`,
        ],

        // Whitespace removal does not work in Svelte
        // due to how Svelte's parser and printer work
        // (the length of the text MUST NOT change)
        [
          `<div class={' flex ' + ' underline ' + ' block '}></div>`,
          `<div class={' flex ' + ' underline ' + ' block '}></div>`,
        ],

        // Escapes
        t`<div class={"before:content-['\\\\2248']"}></div>`,

        // Preserve whitespace in template strings
        // This test has lots of whitespace to ensure that the Svelte
        // parser doesn't produce invalid syntax as output since it breaks
        // when changing the length of the text.
        [
          `<div\n class={\`underline \n flex\`}></div>`,
          `<div\n  class={\`flex \n underline\`}\n></div>`,
        ],

        // Duplicates can be removed in simple attributes
        [
          `<div class="flex flex underline flex flex"></div>`,
          `<div class="flex underline"></div>`,
        ],

        // Duplicates cannot be removed in string literals otherwise invalid
        // code will be produced during printing.
        [
          `<div class={'flex underline flex'}></div>`,
          `<div class={'flex flex underline'}></div>`,
        ],

        // Duplicates cannot be removed in template literals otherwise invalid
        // code will be produced during printing.
        [
          `<div class={\`flex underline flex\`}></div>`,
          `<div class={\`flex flex underline\`}></div>`,
        ],
      ],
    },
  },

  // This test ensures that our plugin works with the multiline array, JSDoc,
  // and import sorting plugins when used together.
  //
  // The plugins actually have to be *imported* in a specific order for
  // them to function correctly *together*.
  {
    plugins: [
      'prettier-plugin-multiline-arrays',
      '@trivago/prettier-plugin-sort-imports',
      'prettier-plugin-jsdoc',
    ],
    options: {
      multilineArraysWrapThreshold: 0,
      importOrder: ['^@one/(.*)$', '^@two/(.*)$', '^[./]'],
      importOrderSortSpecifiers: true,
    },
    tests: {
      babel: [
        [
          dedent`
            import './three'
            import '@two/file'
            import '@one/file'

            /**
              * - Position
              */
            const position = {}
            const arr = ['a', 'b', 'c', 'd', 'e', 'f']
          `,
          dedent`
            import '@one/file'
            import '@two/file'
            import './three'

            /** - Position */
            const position = {}
            const arr = [
              'a',
              'b',
              'c',
              'd',
              'e',
              'f',
            ]
          `,
        ],
      ],
    },
  },
]

for (const group of tests) {
  let name = group.plugins.join(', ')

  for (let parser in group.tests) {
    test(`parsing ${parser} works with: ${name}`, async ({ expect }) => {
      // Hide logs from Pug's prettier plugin
      if (parser === 'pug') {
        let pug = await import('@prettier/plugin-pug')
        // @ts-ignore
        pug.logger.level = 'off'
      }

      let plugins = [
        ...group.plugins.map((name) => require.resolve(name)),
        pluginPath,
      ]

      for (const [input, expected] of group.tests[parser]) {
        let output = await format(input, { parser, plugins, ...group.options })
        expect(output).toEqual(expected)
      }
    })
  }
}
