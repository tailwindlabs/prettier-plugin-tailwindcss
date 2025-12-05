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

function getGroup(className: string): string {
  const parts = className.split(':');
  const base = parts[parts.length - 1];

  if (/^(block|inline|flex|grid|table|contents|hidden|static|fixed|absolute|relative|sticky)$/.test(base)) return 'layout-display';
  if (/^(isolate|z-|top|right|bottom|left|visible|invisible|overflow|overscroll|object|inset)/.test(base)) return 'layout-position';

  if (/^(flex-|justify-|items-|content-|self-|order-|place-|grow|shrink|basis)/.test(base)) return 'flex-grid';
  if (/^(grid-|col-|row-|gap-|auto-cols|auto-rows)/.test(base)) return 'flex-grid';

  if (/^(p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|space-)/.test(base)) return 'spacing';

  if (/^(w-|h-|min-|max-|size-|aspect-)/.test(base)) return 'sizing';

  if (/^(font-|text-|antialiased|subpixel|italic|not-italic|normal-case|uppercase|lowercase|capitalize|tracking-|leading-|align-|whitespace-|break-|hyphens-|content-|decoration-|underline|overline|line-through|no-underline|list-|indent-)/.test(base)) return 'typography';

  if (/^(bg-|gradient-|from-|via-|to-)/.test(base)) return 'backgrounds';

  if (/^(rounded|border|divide|ring|outline|stroke|fill)/.test(base)) return 'borders';

  if (/^(shadow|opacity|mix-|blend-|box-decoration|box-slice)/.test(base)) return 'effects';

  if (/^(blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|backdrop-)/.test(base)) return 'filters';

  if (/^(transition|duration|ease|delay|animate-)/.test(base)) return 'transitions';

  if (/^(scale|rotate|translate|skew|origin-)/.test(base)) return 'transforms';

  if (/^(cursor-|pointer-|resize|scroll-|select-|touch-|will-change|accent-|appearance-|caret-)/.test(base)) return 'interactivity';

  const prefix = base.split('-')[0];
  return prefix;
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

  if (classStr.includes('{{')) {
    return classStr
  }

  if (env.options.tailwindPreserveWhitespace) {
    collapseWhitespace = false
  }

  if (/^[\t\r\f\n ]+$/.test(classStr) && collapseWhitespace) {
    return ' '
  }

  let parts = classStr.split(/([\t\r\f\n ]+)/)
  let classes = parts.filter((_, i) => i % 2 === 0)
  let whitespace = parts.filter((_, i) => i % 2 !== 0)

  if (classes[classes.length - 1] === '') {
    classes.pop()
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

  let result = '';

  // Check if multiline option is enabled
  // @ts-ignore
  const multiline = env.options.tailwindMultiline;

  if (multiline && classList.length > 0) {
      let currentGroup = getGroup(classList[0]);
      result += classList[0];

      for (let i = 1; i < classList.length; i++) {
        let cls = classList[i];
        let group = getGroup(cls);

        if (group !== currentGroup) {
          result += '\n' + cls;
          currentGroup = group;
        } else {
          result += ' ' + cls;
        }
      }

      // If multiline, we should probably ensure the surrounding whitespace logic doesn't kill it.
      // But standard logic handles prefix/suffix.
      // We do NOT want to use `whitespace` array from the original string because we just reconstructed the string.
      // So we ignore `whitespace` (except prefix/suffix which we handled).

  } else {
      // Standard behavior: rejoin with spaces or original whitespace if preserved (but we removed indices so it's tricky)
      // Actually the original implementation re-inserted whitespace.

      // Remove whitespace that appeared before a removed classes
      whitespace = whitespace.filter((_, index) => !removedIndices.has(index + 1))

      for (let i = 0; i < classList.length; i++) {
        result += `${classList[i]}${whitespace[i] ?? ''}`
      }
  }

  if (collapseWhitespace) {
    prefix = prefix.replace(/\s+$/g, ' ')
    suffix = suffix.replace(/^\s+/g, ' ')

    // Only strip start/end of the main result
    result = result
      .replace(/^\s+/, collapseWhitespace.start ? '' : ' ')
      .replace(/\s+$/, collapseWhitespace.end ? '' : ' ')

    // If not multiline, we might want to ensure single spaces?
    // The original code relied on `whitespace` array which contained what was there.
    // If `collapseWhitespace` is true, `whitespace` array elements were replaced by ' ' earlier in `sortClasses`.
    // So `result` is effectively space-separated.
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
  let orderedClasses = reorderClasses(classList, { env })

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
