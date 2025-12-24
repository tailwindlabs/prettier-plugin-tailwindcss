import type { TransformerEnv } from './types'
import { bigSign } from './utils'

function reorderClasses(classList: string[], { env }: { env: TransformerEnv }) {
  let orderedClasses = env.context.getClassOrder(classList)

  return orderedClasses.sort(([nameA, a], [nameZ, z]) => {
    // Move `...` to the end of the list
    if (nameA === '...' || nameA === '…') return 1
    if (nameZ === '...' || nameZ === '…') return -1

    if (a === z) return 0
    if (a === null) return -1
    if (z === null) return 1
    return bigSign(a - z)
  })
}

export function sortClasses(
  classStr: string,
  {
    env,
    ignoreFirst = false,
    ignoreLast = false,
    removeDuplicates = true,
    collapseWhitespace = { start: true, end: true },
  }: {
    env: TransformerEnv
    ignoreFirst?: boolean
    ignoreLast?: boolean
    removeDuplicates?: boolean
    collapseWhitespace?: false | { start: boolean; end: boolean }
  },
): string {
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
  if (collapseWhitespace && /^[\t\r\f\n ]+$/.test(classStr)) {
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

  let { classList, removedIndices } = sortClassList(classes, {
    env,
    removeDuplicates,
  })

  // Remove whitespace that appeared before a removed classes
  whitespace = whitespace.filter((_, index) => !removedIndices.has(index + 1))

  for (let i = 0; i < classList.length; i++) {
    result += `${classList[i]}${whitespace[i] ?? ''}`
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

export function sortClassList(
  classList: string[],
  {
    env,
    removeDuplicates,
  }: {
    env: TransformerEnv
    removeDuplicates: boolean
  },
) {
  // Re-order classes based on the Tailwind CSS configuration
  let orderedClasses = reorderClasses(classList, { env })

  // Remove duplicate Tailwind classes
  if (env.options.tailwindPreserveDuplicates) {
    removeDuplicates = false
  }

  let removedIndices = new Set<number>()

  if (removeDuplicates) {
    let seenClasses = new Set<string>()

    orderedClasses = orderedClasses.filter(([cls, order], index) => {
      if (seenClasses.has(cls)) {
        removedIndices.add(index)
        return false
      }

      // Only consider known classes when removing duplicates
      if (order !== null) {
        seenClasses.add(cls)
      }

      return true
    })
  }

  return {
    classList: orderedClasses.map(([className]) => className),
    removedIndices,
  }
}
