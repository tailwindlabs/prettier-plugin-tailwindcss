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
   * Path to the Tailwind config file (v3).
   *
   * Relative paths are resolved to the prettier config file
   * determined by `filepath` (or the current working directory
   * if no `filepath` is provided).
   *
   * e.g. `./tailwind.config.js`
   *
   * Default: The closest `tailwind.config.{js,mjs,cjs,ts}` file relative to
   *          `filepath` if a local installation of Tailwind CSS v3 is found.
   */
  config?: string

  /**
   * Path to the CSS stylesheet used by Tailwind CSS (v4+)
   *
   * Relative paths are resolved to the prettier config file
   * determined by `filepath` (or the current working directory
   * if no `filepath` is provided).
   *
   * e.g. `./src/app.css`
   *
   * Default: The default Tailwind CSS v4 stylesheet if a local installation of
   * Tailwind CSS v4 is found.
   */
  stylesheet?: string

  /**
   * List of custom function and tag names whose arguments should be treated as
   * a class list and sorted.
   *
   * e.g. `["clsx", "cn", "tw"]`
   *
   * Default: `[]`
   */
  functions?: string[]

  /**
   * List of additional HTML/JSX attributes to sort (beyond `class` and `className`).
   *
   * e.g. `["myClassProp", ":class"]`
   *
   * Default: `[]`
   */
  attributes?: string[]

  /**
   * Preserve whitespace around classes.
   *
   * Default: false
   */
  preserveWhitespace?: boolean

  /**
   * Preserve duplicate classes.
   *
   * Default: false
   */
  preserveDuplicates?: boolean

  /**
   * The package name to use when loading Tailwind CSS.
   *
   * Useful when multiple versions are installed in the same project.
   *
   * Default: `tailwindcss`
   *
   * @internal
   */
  packageName?: string
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
    tailwindPackageName: opts.packageName,
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
