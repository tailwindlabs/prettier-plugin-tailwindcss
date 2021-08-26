const prettierParserHTML = require('prettier/parser-html')
const { createContext } = require('tailwindcss/lib/jit/lib/setupContextUtils')
const { generateRules } = require('tailwindcss/lib/jit/lib/generateRules')
const resolveConfig = require('tailwindcss/resolveConfig')

// just using the default config for now
let context = createContext(resolveConfig({}))

// this would be configurable, 'start' or 'end'
let unknownClassPosition = 'start'

function bigSign(bigIntValue) {
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

function sortClasses(el) {
  let classAttr = el.attrs?.find((attr) => attr.name === 'class')

  if (classAttr) {
    let result = ''
    let parts = classAttr.value.split(/(\s+)/)
    let classes = parts.filter((_, i) => i % 2 === 0)
    let whitespace = parts.filter((_, i) => i % 2 !== 0)

    let classNamesWithOrder = []
    for (let className of classes) {
      let order =
        generateRules(new Set([className]), context).sort(([a], [z]) =>
          bigSign(z - a)
        )[0]?.[0] ?? null
      classNamesWithOrder.push([className, order])
    }

    classes = classNamesWithOrder
      .sort(([, a], [, z]) => {
        if (a === z) return 0
        if (a === null) return unknownClassPosition === 'start' ? -1 : 1
        if (z === null) return unknownClassPosition === 'start' ? 1 : -1
        return bigSign(a - z)
      })
      .map(([className]) => className)

    for (let i = 0; i < classes.length; i++) {
      result += `${classes[i]}${whitespace[i] ?? ''}`
    }

    classAttr.value = result
  }

  if (el.children && el.children.length > 0) {
    el.children.forEach((childEl) => sortClasses(childEl))
  }
}

module.exports = {
  parsers: {
    html: {
      ...prettierParserHTML.parsers.html,
      parse(text, parsers, options) {
        let ast = prettierParserHTML.parsers.html.parse(text, parsers, options)
        sortClasses(ast)
        return ast
      },
    },
  },
}
