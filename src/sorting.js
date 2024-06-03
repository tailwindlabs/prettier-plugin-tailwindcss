export function bigSign(bigIntValue) {
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

function prefixCandidate(context, selector) {
  let prefix = context.tailwindConfig.prefix
  return typeof prefix === 'function' ? prefix(selector) : prefix + selector
}

// Polyfill for older Tailwind CSS versions
function getClassOrderPolyfill(classes, { env }) {
  // A list of utilities that are used by certain Tailwind CSS utilities but
  // that don't exist on their own. This will result in them "not existing" and
  // sorting could be weird since you still require them in order to make the
  // host utitlies work properly. (Thanks Biology)
  let parasiteUtilities = new Set([
    prefixCandidate(env.context, 'group'),
    prefixCandidate(env.context, 'peer'),
  ])

  let classNamesWithOrder = []

  for (let className of classes) {
    let order =
      env
        .generateRules(new Set([className]), env.context)
        .sort(([a], [z]) => bigSign(z - a))[0]?.[0] ?? null

    if (order === null && parasiteUtilities.has(className)) {
      // This will make sure that it is at the very beginning of the
      // `components` layer which technically means 'before any
      // components'.
      order = env.context.layerOrder.components
    }

    classNamesWithOrder.push([className, order])
  }

  return classNamesWithOrder
}

function reorderClasses(classList, { env, removeDuplicates }) {
  if (env.options.tailwindPreserveDuplicates) {
    removeDuplicates = false
  }

  let orderedClasses = env.context.getClassOrder
    ? env.context.getClassOrder(classList)
    : getClassOrderPolyfill(classList, { env })

  orderedClasses.sort(([, a], [, z]) => {
    if (a === z) return 0
    if (a === null) return -1
    if (z === null) return 1
    return bigSign(a - z)
  })

  let removedIndices = new Set()

  if (removeDuplicates) {
    let seenClasses = new Set()

    orderedClasses = orderedClasses.filter(([cls, order], index) => {
      if (seenClasses.has(cls)) {
        removedIndices.add(index)
        return false
      }

      // Only considers known classes when removing duplicates
      if (order !== null) {
        seenClasses.add(cls)
      }

      return true
    })
  }

  return {
    orderedClasses,
    removedIndices,
  }
}

/**
 * @param {string} classStr
 * @param {object} opts
 * @param {any} opts.env
 * @param {boolean} [opts.ignoreFirst]
 * @param {boolean} [opts.ignoreLast]
 * @param {boolean} [opts.removeDuplicates]
 * @param {object} [opts.collapseWhitespace]
 * @param {boolean} [opts.collapseWhitespace.start]
 * @param {boolean} [opts.collapseWhitespace.end]
 * @returns {string}
 */
export function sortClasses(
  classStr,
  {
    env,
    ignoreFirst = false,
    ignoreLast = false,
    removeDuplicates = true,
    collapseWhitespace = { start: true, end: true },
  },
) {
  if (typeof classStr !== 'string' || classStr === '') {
    return classStr
  }

  // Ignore class attributes containing `{{`, to match Prettier behaviour:
  // https://github.com/prettier/prettier/blob/8a88cdce6d4605f206305ebb9204a0cabf96a070/src/language-html/embed/class-names.js#L9
  if (classStr.includes('{{')) {
    return classStr
  }

  if (env.options.tailwindPreserveWhitespace) {
    collapseWhitespace = false
  }

  // This class list is purely whitespace
  // Collapse it to a single space if the option is enabled
  if (/^[\t\r\f\n ]+$/.test(classStr) && collapseWhitespace) {
    return ' '
  }

  let result = ''
  let parts = classStr.split(/([\t\r\f\n ]+)/)
  let classes = parts.filter((_, i) => i % 2 === 0)
  let whitespace = parts.filter((_, i) => i % 2 !== 0)

  if (classes[classes.length - 1] === '') {
    classes.pop()
  }

  if (collapseWhitespace) {
    whitespace = whitespace.map(() => ' ')
  }

  let prefix = ''
  if (ignoreFirst) {
    prefix = `${classes.shift() ?? ''}${whitespace.shift() ?? ''}`
  }

  let suffix = ''
  if (ignoreLast) {
    suffix = `${whitespace.pop() ?? ''}${classes.pop() ?? ''}`
  }

  let { orderedClasses, removedIndices } = reorderClasses(classes, {
    env,
    removeDuplicates,
  })

  // Remove whitespace that appeared before a removed classes
  whitespace = whitespace.filter((_, index) => !removedIndices.has(index + 1))

  classes = orderedClasses.map(([className]) => className)

  for (let i = 0; i < classes.length; i++) {
    result += `${classes[i]}${whitespace[i] ?? ''}`
  }

  if (collapseWhitespace) {
    prefix = prefix.replace(/\s+$/g, ' ')
    suffix = suffix.replace(/^\s+/g, ' ')

    result = result
      .replace(/^\s+/, collapseWhitespace.start ? '' : ' ')
      .replace(/\s+$/, collapseWhitespace.end ? '' : ' ')
  }

  return prefix + result + suffix
}

export function sortClassList(classList, { env }) {
  let { orderedClasses } = reorderClasses(classList, {
    env,
    removeDuplicates: false,
  })

  return orderedClasses.map(([className]) => className)
}
