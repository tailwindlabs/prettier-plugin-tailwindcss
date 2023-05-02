const prettier = require('prettier')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { t, yes, no } = require('./utils')

function format(str, options = {}) {
  options.plugins = options.plugins ?? [
    require.resolve('prettier-plugin-astro'),
    require.resolve('prettier-plugin-svelte'),
    require.resolve('prettier-plugin-marko'),
  ]

  options.plugins = [...options.plugins, path.resolve(__dirname, '..')]

  return prettier
    .format(str, {
      pluginSearchDirs: [__dirname], // disable plugin autoload
      semi: false,
      singleQuote: true,
      printWidth: 9999,
      parser: 'html',
      ...options,
    })
    .trim()
}

function formatFixture(name) {
  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')
  let filePath = path.resolve(__dirname, `fixtures/${name}/index.html`)
  let cmd = `${binPath} ${filePath} --plugin-search-dir ${__dirname} --plugin ${path.resolve(
    __dirname,
    '..',
  )}`

  return execSync(cmd).toString().trim()
}

let html = [
  t`<div class="${yes}"></div>`,
  t`<!-- <div class="${no}"></div> -->`,
  t`<div class="${no} {{ 'p-0 sm:p-0 m-0' }}"></div>`,
  t`<div not-class="${no}"></div>`,
  ['<div class="  sm:p-0   p-0 "></div>', '<div class="p-0 sm:p-0"></div>'],
  t`<div class></div>`,
  t`<div class=""></div>`,
]

let css = [
  t`@apply ${yes};`,
  t`/* @apply ${no}; */`,
  t`@not-apply ${no};`,
  ['@apply sm:p-0\n   p-0;', '@apply p-0\n   sm:p-0;'],
]

let javascript = [
  t`;<div class="${yes}" />`,
  t`/* <div class="${no}" /> */`,
  t`// <div class="${no}" />`,
  t`;<div not-class="${no}" />`,
  t`;<div class={\`${yes}\`} />`,
  t`;<div class={\`${yes} \${'${yes}'} \${'${yes}' ? '${yes}' : '${yes}'}\`} />`,
  t`;<div class={'${yes}'} />`,
  t`;<div class={'${yes}' + '${yes}'} />`,
  t`;<div class={'${yes}' ? '${yes}' + '${yes}' : '${yes}'} />`,
  t`;<div class={clsx('${yes}', ['${yes}'])} />`,
  t`;<div class={clsx({ '${yes}': '${yes}' })} />`,
  t`;<div class={{ '${yes}': '${yes}' }['${yes}']} />`,
  t`;<div class />`,
  t`;<div class="" />`,
  [
    `;<div class={\`sm:block inline flex\${someVar}\`} />`,
    `;<div class={\`inline sm:block flex\${someVar}\`} />`,
  ],
  [
    `;<div class={\`\${someVar}sm:block md:inline flex\`} />`,
    `;<div class={\`\${someVar}sm:block flex md:inline\`} />`,
  ],
  [
    `;<div class={\`sm:p-0 p-0 \${someVar}sm:block md:inline flex\`} />`,
    `;<div class={\`p-0 sm:p-0 \${someVar}sm:block flex md:inline\`} />`,
  ],
]
javascript = javascript.concat(
  javascript.map((test) => test.map((t) => t.replace(/class/g, 'className'))),
)

let vue = [
  ...html,
  t`<div :class="'${yes}'"></div>`,
  t`<!-- <div :class="'${no}'"></div> -->`,
  t`<div :class></div>`,
  t`<div :class=""></div>`,
  t`<div :class="'${yes}' + '${yes}'"></div>`,
  t`<div :class="['${yes}', '${yes}']"></div>`,
  t`<div :class="[cond ? '${yes}' : '${yes}']"></div>`,
  t`<div :class="[someVar ?? '${yes}']"></div>`,
  t`<div :class="{ '${yes}': true }"></div>`,
  t`<div :class="clsx('${yes}')"></div>`,
  t`<div :class="\`${yes}\`"></div>`,
  t`<div :class="\`${yes} \${someVar}\`"></div>`,
  t`<div :class="someVar! ? \`${yes}\` : \`${yes}\`"></div>`, // ts
  t`<div :class="someVar ? someFunc(someVar as string) + '${yes}' : ''"></div>`, // ts
  [
    `<div :class="\`sm:block inline flex\${someVar}\`"></div>`,
    `<div :class="\`inline sm:block flex\${someVar}\`"></div>`,
  ],
  [
    `<div :class="\`\${someVar}sm:block md:inline flex\`"></div>`,
    `<div :class="\`\${someVar}sm:block flex md:inline\`"></div>`,
  ],
  [
    `<div :class="\`sm:p-0 p-0 \${someVar}sm:block md:inline flex\`"></div>`,
    `<div :class="\`p-0 sm:p-0 \${someVar}sm:block flex md:inline\`"></div>`,
  ],
]

let glimmer = [
  t`<div class='${yes}'></div>`,
  t`<!-- <div class='${no}'></div> -->`,
  t`<div class='${yes} {{"${yes}"}}'></div>`,
  t`<div class='${yes} {{"${yes}"}} ${yes}'></div>`,
  t`<div class='${yes} {{"${yes}"}} {{if someVar "${yes}" "${yes}"}}'></div>`,
  t`<div class='${yes} {{"${yes}"}} {{if someVar "${yes}" "${yes}"}}' {{if someVar "attr='${no}'" "attr='${no}'"}}></div>`,
  [
    `<div class='md:inline flex sm:block{{someVar}}'></div>`,
    `<div class='flex md:inline sm:block{{someVar}}'></div>`,
  ],
  [
    `<div class='sm:p-0 p-0 {{someVar}}sm:block md:inline flex'></div>`,
    `<div class='p-0 sm:p-0 {{someVar}}sm:block flex md:inline'></div>`,
  ],
  t`<div not-class='${no}'></div>`,
  ["<div class='  sm:p-0   p-0 '></div>", "<div class='p-0 sm:p-0'></div>"],
  t`<div class></div>`,
  t`<div class=''></div>`,
  t`{{link 'Some page' href=person.url class='${no}'}}`,
  t`<div class='{{if @isTrue (concat "border-l-4 border-" @borderColor)}}'></div>`,
  [
    `<div class='{{if @isTrue (concat "border-opacity-30 border-l-4 border-" @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (concat "border-l-4 border-opacity-30 border-" @borderColor)}}'></div>`,
  ],
  [
    `<div class='{{if @isTrue (concat "border-l-4 border " @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (concat "border border-l-4 " @borderColor)}}'></div>`,
  ],
  [
    `<div class='{{if @isTrue (nope "border-l-4 border-" @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (nope "border- border-l-4" @borderColor)}}'></div>`,
  ],
]

let tests = {
  html,
  glimmer,
  lwc: html,
  vue: [
    ...vue,
    t`<div :class="\`${yes} \${someVar} ${yes} \${'${yes}'}\`"></div>`,
  ],
  angular: [
    ...html,
    t`<div [ngClass]="'${yes}'"></div>`,
    t`<!-- <div [ngClass]="'${no}'"></div> -->`,
    t`<div [ngClass]></div>`,
    t`<div [ngClass]=""></div>`,
    t`<div [ngClass]="'${yes}' + '${yes}'"></div>`,
    t`<div [ngClass]="['${yes}', '${yes}']"></div>`,
    t`<div [ngClass]="[cond ? '${yes}' : '${yes}']"></div>`,
    t`<div [ngClass]="[someVar ?? '${yes}']"></div>`,
    t`<div [ngClass]="{ '${yes}': true }"></div>`,
    t`<div [ngClass]="clsx('${yes}')"></div>`,
    t`<div [ngClass]="{ '${yes}': (some.thing | urlPipe: { option: true } | async), '${yes}': true }"></div>`,
    t`<div [ngClass]="{ '${yes}': foo && bar?.['baz'] }" class="${yes}"></div>`,

    // TODO: Enable this test — it causes console noise but not a failure
    // t`<div [ngClass]="{ '${no}': foo && definitely&a:syntax*error }" class="${yes}"></div>`,
  ],
  css: [...css, t`@apply ${yes} !important;`],
  scss: [...css, t`@apply ${yes} #{!important};`],
  less: [...css, t`@apply ${yes} !important;`],
  babel: javascript,
  typescript: javascript,
  'babel-ts': javascript,
  flow: javascript,
  'babel-flow': javascript,
  espree: javascript,
  meriyah: javascript,
  mdx: javascript
    .filter((test) => !test.find((t) => /^\/\*/.test(t)))
    .map((test) => test.map((t) => t.replace(/^;/, ''))),
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
    ['<div class={`sm:p-0\np-0`} />', '<div\n  class={`p-0\nsm:p-0`}\n/>'],
    [
      `{#await promise()} <div class="sm:p-0 p-0"></div> {:then} <div class="sm:p-0 p-0"></div> {/await}`,
      `{#await promise()} <div class="p-0 sm:p-0" /> {:then} <div class="p-0 sm:p-0" /> {/await}`,
    ],
    [
      `{#await promise() then} <div class="sm:p-0 p-0"></div> {/await}`,
      `{#await promise() then} <div class="p-0 sm:p-0" /> {/await}`,
    ],
  ],
  astro: [
    ...html,
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
  ],
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
  ],
}

let fixtures = [
  {
    name: 'no prettier config',
    dir: 'no-prettier-config',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'inferred config path',
    dir: 'basic',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'inferred config path (.cjs)',
    dir: 'cjs',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using esm config',
    dir: 'esm',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using esm config (explicit path)',
    dir: 'esm-explicit',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using ts config',
    dir: 'ts',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using ts config (explicit path)',
    dir: 'ts-explicit',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using v3.2.7',
    dir: 'v3-2',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'plugins',
    dir: 'plugins',
    output: '<div class="uppercase foo sm:bar"></div>',
  },
]

describe('parsers', () => {
  for (let parser in tests) {
    test(parser, () => {
      for (let [input, expected] of tests[parser]) {
        expect(format(input, { parser })).toEqual(expected)
      }
    })
  }
})

describe('other', () => {
  test('non-tailwind classes', () => {
    expect(
      format('<div class="sm:lowercase uppercase potato text-sm"></div>'),
    ).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
  })

  test('parasite utilities', () => {
    expect(
      format('<div class="group peer unknown-class p-0 container"></div>'),
    ).toEqual('<div class="unknown-class group peer container p-0"></div>')
  })

  test('explicit config path', () => {
    expect(
      format('<div class="sm:bg-tomato bg-red-500"></div>', {
        tailwindConfig: path.resolve(
          __dirname,
          'fixtures/basic/tailwind.config.js',
        ),
      }),
    ).toEqual('<div class="bg-red-500 sm:bg-tomato"></div>')
  })
})

describe('fixtures', () => {
  let configs = [
    {
      from: __dirname + '/../.prettierignore',
      to: __dirname + '/../.prettierignore.testing',
    },
    {
      from: __dirname + '/../prettier.config.js',
      to: __dirname + '/../prettier.config.js.testing',
    },
  ]

  // Temporarily move config files out of the way so they don't interfere with the tests
  beforeAll(() => configs.forEach(({ from, to }) => fs.renameSync(from, to)))
  afterAll(() => configs.forEach(({ from, to }) => fs.renameSync(to, from)))

  for (const fixture of fixtures) {
    test(fixture.name, () => {
      expect(formatFixture(fixture.dir)).toEqual(fixture.output)
    })
  }
})
