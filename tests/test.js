const prettier = require('prettier')
const path = require('path')
const { execSync } = require('child_process')

function format(str, options = {}) {
  return prettier
    .format(str, {
      pluginSearchDirs: [__dirname], // disable plugin autoload
      plugins: [path.resolve(__dirname, '..')],
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
  return execSync(`${binPath} ${filePath}`).toString().trim()
}

let yes = '__YES__'
let no = '__NO__'
let testClassName = 'sm:p-0 p-0'
let testClassNameSorted = 'p-0 sm:p-0'

function t(strings, ...values) {
  let input = ''
  strings.forEach((string, i) => {
    input += string + (values[i] ? testClassName : '')
  })

  let output = ''
  strings.forEach((string, i) => {
    let value = values[i] || ''
    if (value === yes) value = testClassNameSorted
    else if (value === no) value = testClassName
    output += string + value
  })

  return [input, output]
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
  javascript.map((test) => test.map((t) => t.replace(/class/g, 'className')))
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

let tests = {
  html,
  lwc: html,
  vue: [
    ...vue,
    t`<div :class="\`${yes} \${someVar} ${yes} \${'${yes}'}\`"></div>`,
  ],
  angular: [
    ...vue.map((test) => test.map((t) => t.replace(/:class=/g, '[ngClass]='))),
    t`<div [ngClass]='\`${yes} \${someVar} ${yes} \${"${yes}"}\`'></div>`,
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
  ],
}

describe('parsers', () => {
  for (let parser in tests) {
    test(parser, () => {
      for (let [input, expected] of tests[parser]) {
        expect(format(input, { parser })).toEqual(expected)
      }
    })
  }
})

test('non-tailwind classes', () => {
  expect(
    format('<div class="sm:lowercase uppercase potato text-sm"></div>')
  ).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
})

test('inferred config path', () => {
  expect(formatFixture('basic')).toEqual(
    '<div class="bg-red-500 sm:bg-tomato"></div>'
  )
})

test('inferred config path (.cjs)', () => {
  expect(formatFixture('cjs')).toEqual(
    '<div class="bg-red-500 sm:bg-hotpink"></div>'
  )
})

test('explicit config path', () => {
  expect(
    format('<div class="sm:bg-tomato bg-red-500"></div>', {
      tailwindConfig: path.resolve(
        __dirname,
        'fixtures/basic/tailwind.config.js'
      ),
    })
  ).toEqual('<div class="bg-red-500 sm:bg-tomato"></div>')
})

test('plugins', () => {
  expect(formatFixture('plugins')).toEqual(
    '<div class="uppercase line-clamp-1 sm:line-clamp-2"></div>'
  )
})
