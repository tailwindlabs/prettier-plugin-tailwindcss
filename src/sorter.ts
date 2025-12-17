import type { ParserOptions } from 'prettier'
import { getTailwindConfig } from './config.js'
import type { PluginOptions } from './index.js'
import { sortClasses, sortClassList } from './sorting.js'
import type { TransformerEnv } from './types.js'

export interface SorterOptions {
  /**
   * The path to the file being formatted
   *
   * Used when loading Tailwind CSS and locating config files
   */
  filepath?: string

  /**
   * Path to the Tailwind config file.
   */
  config?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+)
   */
  stylesheet?: string

  /**
   * List of custom function and tag names that contain classes.
   *
   * Default: []
   */
  functions?: string[]

  /**
   * List of custom attributes that contain classes.
   *
   * Default: []
   */
  attributes?: string[]

  /**
   * Preserve whitespace around Tailwind classes when sorting.
   *
   * Default: false
   */
  preserveWhitespace?: boolean

  /**
   * Preserve duplicate classes inside a class list when sorting.
   *
   * Default: false
   */
  preserveDuplicates?: boolean
}

export interface Sorter {
  /**
   * Sort one or more class attributes.
   *
   * Each element is the value of an HTML `class` attribute (or similar). i.e. a
   * space separated list of class names as a string.
   *
   * Postconditions:
   * - The returned list is the same length and in the same order as `classes`.
   * - Unknown classes are kept in their original, relative order but are moved
   *   to the beginning of the list.
   * - The special "..." token is sorted to the end.
   */
  sortClassAttributes(classes: string[]): string[]

  /**
   * Sort one or more class lists.
   *
   * Each element is an array of class names. Passing a space separated class
   * list in each element is not supported.
   *
   * Postconditions:
   * - The returned list is the same length and in the same order as `classes`.
   * - Unknown classes are kept in their original, relative order but are moved
   *   to the beginning of the list.
   * - The special "..." token is sorted to the end.
   * - When removing duplicates they are replaced with `null`
   */
  sortClassLists(classes: string[][]): (string | null)[][]
}

export async function createSorter(opts: SorterOptions): Promise<Sorter> {
  let preserveDuplicates = opts.preserveDuplicates ?? false
  let preserveWhitespace = opts.preserveWhitespace ?? false

  let options: ParserOptions & PluginOptions = {
    filepath: opts.filepath as any,
    tailwindConfig: opts.config,
    tailwindStylesheet: opts.stylesheet,
    tailwindFunctions: opts.functions,
    tailwindAttributes: opts.attributes,
    tailwindPreserveWhitespace: preserveWhitespace,
    tailwindPreserveDuplicates: preserveDuplicates,
  } as any

  let api = await getTailwindConfig(options)

  let env: TransformerEnv = {
    context: api,
    changes: [],
    options,
    matcher: undefined as any,
  }

  return {
    sortClassLists(classes) {
      return classes.map((list) => {
        let result = sortClassList({
          api,
          classList: list,
          removeDuplicates: !preserveDuplicates,
        })

        let sorted: (string | null)[] = [...result.classList]
        for (let idx of result.removedIndices) {
          sorted[idx] = null
        }

        return sorted
      })
    },

    sortClassAttributes(classes) {
      return classes.map((list) => sortClasses(list, { env }))
    },
  }
}
