const prettier = require('prettier')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { t, yes, no, format, pluginPath } = require('./utils')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function formatFixture(name, extension) {
  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')
  let filePath = path.resolve(__dirname, `fixtures/${name}/index.${extension}`)

  let cmd = `${binPath} ${filePath} --plugin ${pluginPath}`

  return execAsync(cmd).then(({ stdout }) => stdout.trim())
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
  [
    `;<div class="block px-1\u3000py-2" />`,
    `;<div class="px-1\u3000py-2 block" />`,
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
  acorn: javascript,
  meriyah: javascript,
  mdx: javascript
    .filter((test) => !test.find((t) => /^\/\*/.test(t)))
    .map((test) => test.map((t) => t.replace(/^;/, ''))),
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
  {
    name: 'customizations: js/jsx',
    dir: 'custom-jsx',
    ext: 'jsx',
    output: `const a = sortMeFn("p-2 sm:p-1");
const b = sortMeFn({
  foo: "p-2 sm:p-1",
});

const c = dontSortFn("sm:p-1 p-2");
const d = sortMeTemplate\`p-2 sm:p-1\`;
const e = dontSortMeTemplate\`sm:p-1 p-2\`;
const f = tw.foo\`p-2 sm:p-1\`;
const g = tw.foo.bar\`p-2 sm:p-1\`;
const h = no.foo\`sm:p-1 p-2\`;
const i = no.tw\`sm:p-1 p-2\`;

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="p-2 sm:p-1" dontSort="sm:p-1 p-2" />;`,
  },
  {
    name: 'customizations: vue',
    dir: 'custom-vue',
    ext: 'vue',
    output: `<script setup>
let a = sortMeFn("p-2 sm:p-1");
let b = sortMeFn({ "p-2 sm:p-1": true });
let c = dontSortFn("sm:p-1 p-2");
let d = sortMeTemplate\`p-2 sm:p-1\`;
let e = dontSortMeTemplate\`sm:p-1 p-2\`;
</script>
<template>
  <div class="p-2 sm:p-1" sortMe="p-2 sm:p-1" dontSortMe="sm:p-1 p-2"></div>
  <div :class="{ 'p-2 sm:p-1': true }"></div>
</template>`,
  },
]

describe('parsers', () => {
  for (let parser in tests) {
    test(parser, async () => {
      for (let [input, expected] of tests[parser]) {
        expect(await format(input, { parser })).toEqual(expected)
      }
    })
  }
})

describe('other', () => {
  test('non-tailwind classes', async () => {
    expect(
      await format('<div class="sm:lowercase uppercase potato text-sm"></div>'),
    ).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
  })

  test('parasite utilities', async () => {
    expect(
      await format(
        '<div class="group peer unknown-class p-0 container"></div>',
      ),
    ).toEqual('<div class="unknown-class group peer container p-0"></div>')
  })

  test('explicit config path', async () => {
    expect(
      await format('<div class="sm:bg-tomato bg-red-500"></div>', {
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
  beforeAll(() =>
    Promise.all(configs.map(({ from, to }) => fs.promises.rename(from, to))),
  )

  afterAll(() =>
    Promise.all(configs.map(({ from, to }) => fs.promises.rename(to, from))),
  )

  for (const fixture of fixtures) {
    test(fixture.name, async () => {
      let formatted = await formatFixture(fixture.dir, fixture.ext ?? 'html')
      expect(formatted).toEqual(fixture.output)
    })
  }
})
