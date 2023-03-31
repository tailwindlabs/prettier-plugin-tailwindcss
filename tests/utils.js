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
