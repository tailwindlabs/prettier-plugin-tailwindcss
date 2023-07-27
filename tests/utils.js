const prettier = require('prettier')
const path = require('path')

let testClassName = 'sm:p-0 p-0'
let testClassNameSorted = 'p-0 sm:p-0'
let yes = '__YES__'
let no = '__NO__'

module.exports.yes = yes
module.exports.no = no

module.exports.t = function t(strings, ...values) {
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

let pluginPath = path.resolve(__dirname, '../dist/index.mjs')

module.exports.pluginPath = pluginPath

module.exports.format = async function format(str, options = {}) {
  let result = await prettier.format(str, {
    pluginSearchDirs: [__dirname], // disable plugin autoload
    semi: false,
    singleQuote: true,
    printWidth: 9999,
    parser: 'html',
    ...options,
    plugins: [...(options.plugins ?? []), pluginPath],
  })

  return result.trim()
}
