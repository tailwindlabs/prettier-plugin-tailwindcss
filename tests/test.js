const prettier = require('prettier')
const path = require('path')

function format(str, options = {}) {
  return prettier
    .format(str, {
      plugins: [path.resolve(__dirname, '..')],
      semi: false,
      singleQuote: true,
      printWidth: 9999,
      parser: 'html',
      ...options,
    })
    .trim()
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

const html = [t`<div class="${yes}"></div>`, t`<div not-class="${no}"></div>`]

const css = [t`@apply ${yes};`, t`@not-apply ${no};`]

const javascript = [
  t`;<div className="${yes}"></div>`,
  t`;<div className={\`${yes} \${'${yes}'} \${'${no}' ? '${yes}' : '${yes}'}\`}></div>`,
  t`;<div className={'${yes}'}></div>`,
  t`;<div className={'${yes}' + '${yes}'}></div>`,
  t`;<div className={'${no}' ? '${yes}' + '${yes}' : '${yes}'}></div>`,
  t`;<div className={clsx('${yes}', ['${yes}'])}></div>`,
  t`;<div className={clsx({ '${no}': '${no}' })}></div>`,
  t`;<div className={{ '${no}': '${no}' }['${no}']}></div>`,
]

const vue = [
  t`<div :class="'${yes}'"></div>`,
  t`<div :class="'${yes}' + '${yes}'"></div>`,
  t`<div :class="['${yes}']"></div>`,
  t`<div :class="['${no}' ? '${yes}' : '${yes}']"></div>`,
  t`<div :class="{ '${yes}': true, '${yes}': '${no}' }"></div>`,
  t`<div :class="{ '${no}': '${no}' }['${no}']"></div>`,
]

const tests = {
  html,
  lwc: html,
  vue: [...html, ...vue],
  angular: [
    ...html,
    ...vue.map((test) => test.map((t) => t.replace(/:class/g, '[ngClass]'))),
  ],
  css,
  scss: css,
  less: css,
  babel: javascript,
  typescript: javascript,
  'babel-ts': javascript,
  flow: javascript,
  'babel-flow': javascript,
  espree: javascript,
  meriyah: javascript,
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

test('custom config', () => {
  // inferred config path
  expect(
    format('<div class="sm:bg-tomato bg-red-500"></div>', {
      filepath: path.resolve(__dirname, 'fixtures/basic/fake.html'),
    })
  ).toEqual('<div class="bg-red-500 sm:bg-tomato"></div>')

  // inferred config path (.cjs)
  expect(
    format('<div class="sm:bg-hotpink bg-red-500"></div>', {
      filepath: path.resolve(__dirname, 'fixtures/cjs/fake.html'),
    })
  ).toEqual('<div class="bg-red-500 sm:bg-hotpink"></div>')

  // explicit config path
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
  expect(
    format('<div class="sm:line-clamp-2 line-clamp-1 uppercase"></div>', {
      tailwindConfig: path.resolve(
        __dirname,
        'fixtures/plugins/tailwind.config.js'
      ),
    })
  ).toEqual('<div class="uppercase line-clamp-1 sm:line-clamp-2"></div>')
})
