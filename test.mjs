import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import prettier from 'prettier'

function format(str, parser, options = {}) {
  return prettier.format(str, {
    parser,
    plugins: ['.'],
    semi: false,
    singleQuote: true,
    printWidth: 9999,
    ...options,
  })
}

let yes = '__YES__'
let no = '__NO__'
let testClassName = 'sm:p-0 p-0'
let testClassNameSorted = 'p-0 sm:p-0'

function test(strings, ...values) {
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

const html = [
  test`<div class="${yes}"></div>`,
  test`<div not-class="${no}"></div>`,
]

const css = [test`@apply ${yes};`, test`@not-apply ${no};`]

const javascript = [
  test`;<div className="${yes}"></div>`,
  test`;<div className={\`${yes} \${'${yes}'} \${'${no}' ? '${yes}' : '${yes}'}\`}></div>`,
  test`;<div className={'${yes}'}></div>`,
  test`;<div className={'${yes}' + '${yes}'}></div>`,
  test`;<div className={'${no}' ? '${yes}' + '${yes}' : '${yes}'}></div>`,
  test`;<div className={clsx('${yes}', ['${yes}'])}></div>`,
  test`;<div className={clsx({ '${no}': '${no}' })}></div>`,
  test`;<div className={{ '${no}': '${no}' }['${no}']}></div>`,
]

const vue = [
  test`<div :class="'${yes}'"></div>`,
  test`<div :class="'${yes}' + '${yes}'"></div>`,
  test`<div :class="['${yes}']"></div>`,
  test`<div :class="['${no}' ? '${yes}' : '${yes}']"></div>`,
  test`<div :class="{ '${yes}': true, '${yes}': '${no}' }"></div>`,
  test`<div :class="{ '${no}': '${no}' }['${no}']"></div>`,
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

for (let parser in tests) {
  let test = suite(parser)
  for (let [input, expected] of tests[parser]) {
    test(input, () => {
      assert.snapshot(format(input, parser), `${expected}\n`)
    })
  }
  test.run()
}
