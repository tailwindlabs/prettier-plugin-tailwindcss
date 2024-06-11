import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let testClassName = 'sm:p-0 p-0'
let testClassNameSorted = 'p-0 sm:p-0'

export let yes = '__YES__'
export let no = '__NO__'

export function t(strings, ...values) {
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

  return [input, output, { tailwindPreserveWhitespace: true }]
}

export let pluginPath = path.resolve(__dirname, '../dist/index.mjs')

export async function format(str, options = {}) {
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
