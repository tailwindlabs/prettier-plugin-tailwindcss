const prettier = require('prettier')

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

for (let parser in tests) {
  test(parser, () => {
    for (let [input, expected] of tests[parser]) {
      expect(format(input, parser)).toEqual(`${expected}\n`)
    }
  })
}
