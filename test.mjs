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

const html = [
  ['<div class="sm:p-0 p-0"></div>', '<div class="p-0 sm:p-0"></div>'],
  ['<div not-class="sm:p-0 p-0"></div>', '<div not-class="sm:p-0 p-0"></div>'],
]

const css = [
  ['@apply sm:p-0 p-0;', '@apply p-0 sm:p-0;'],
  ['@not-apply sm:p-0 p-0;', '@not-apply sm:p-0 p-0;'],
]

const javascript = [
  [
    ';<div className="sm:p-0 p-0"></div>',
    ';<div className="p-0 sm:p-0"></div>',
  ],
  [
    ";<div className={`sm:p-0 p-0 ${'sm:p-0 p-0'} ${'sm:p-0 p-0' ? 'sm:p-0 p-0' : 'sm:p-0 p-0'}`}></div>",
    ";<div className={`p-0 sm:p-0 ${'p-0 sm:p-0'} ${'sm:p-0 p-0' ? 'p-0 sm:p-0' : 'p-0 sm:p-0'}`}></div>",
  ],
  [
    ";<div className={'sm:p-0 p-0'}></div>",
    ";<div className={'p-0 sm:p-0'}></div>",
  ],
  [
    ";<div className={'sm:p-0 p-0' + 'sm:p-0 p-0'}></div>",
    ";<div className={'p-0 sm:p-0' + 'p-0 sm:p-0'}></div>",
  ],
  [
    ";<div className={'sm:p-0 p-0' ? 'sm:p-0 p-0' + 'sm:p-0 p-0' : 'sm:p-0 p-0'}></div>",
    ";<div className={'sm:p-0 p-0' ? 'p-0 sm:p-0' + 'p-0 sm:p-0' : 'p-0 sm:p-0'}></div>",
  ],
  [
    ";<div className={clsx('sm:p-0 p-0', ['sm:p-0 p-0'])}></div>",
    ";<div className={clsx('p-0 sm:p-0', ['p-0 sm:p-0'])}></div>",
  ],
  [
    ";<div className={clsx({ 'sm:p-0 p-0': 'sm:p-0 p-0' })}></div>",
    ";<div className={clsx({ 'sm:p-0 p-0': 'sm:p-0 p-0' })}></div>",
  ],
  [
    ";<div className={{ 'sm:p-0 p-0': 'sm:p-0 p-0' }['sm:p-0 p-0']}></div>",
    ";<div className={{ 'sm:p-0 p-0': 'sm:p-0 p-0' }['sm:p-0 p-0']}></div>",
  ],
]

const vue = [
  [
    '<div :class="\'sm:p-0 p-0\'"></div>',
    '<div :class="\'p-0 sm:p-0\'"></div>',
  ],
  [
    "<div :class=\"'sm:p-0 p-0' + 'sm:p-0 p-0'\"></div>",
    "<div :class=\"'p-0 sm:p-0' + 'p-0 sm:p-0'\"></div>",
  ],
  [
    '<div :class="[\'sm:p-0 p-0\']"></div>',
    '<div :class="[\'p-0 sm:p-0\']"></div>',
  ],
  [
    "<div :class=\"['sm:p-0 p-0' ? 'sm:p-0 p-0' : 'sm:p-0 p-0']\"></div>",
    "<div :class=\"['sm:p-0 p-0' ? 'p-0 sm:p-0' : 'p-0 sm:p-0']\"></div>",
  ],
  [
    "<div :class=\"{ 'sm:p-0 p-0': true, 'sm:p-0 p-0': 'sm:p-0 p-0' }\"></div>",
    "<div :class=\"{ 'p-0 sm:p-0': true, 'p-0 sm:p-0': 'sm:p-0 p-0' }\"></div>",
  ],
  [
    "<div :class=\"{ 'sm:p-0 p-0': 'sm:p-0 p-0' }['sm:p-0 p-0']\"></div>",
    "<div :class=\"{ 'sm:p-0 p-0': 'sm:p-0 p-0' }['sm:p-0 p-0']\"></div>",
  ],
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
