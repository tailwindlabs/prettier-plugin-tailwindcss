import type { AstPath, ParserOptions, Plugin } from 'prettier'
import type { TransformerEnv } from './types'

export function defineTransform<T>(opts: TransformOptions<T>) {
  return opts
}

export interface TransformOptions<T> {
  /**
   * Static attributes that are supported by default
   */
  staticAttrs?: string[]

  /**
   * Dynamic / expression attributes that are supported by default
   */
  dynamicAttrs?: string[]

  /**
   * Load the given plugins for the parsers and printers
   */
  load?: Array<string | Plugin<any>>

  /**
   * A list of compatible, third-party plugins for this transformation step
   *
   * The loading of these is delayed until the actual parse call as
   * using the parse() function from these plugins may cause errors
   * if they haven't already been loaded by Prettier.
   */
  compatible?: string[]

  /**
   * A list of supported parser names
   */
  parsers: Record<
    string,
    {
      /**
       * Load the given plugins for the parsers and printers
       */
      load?: Array<string | Plugin<any>>

      /**
       * Static attributes that are supported by default
       */
      staticAttrs?: string[]

      /**
       * Dynamic / expression attributes that are supported by default
       */
      dynamicAttrs?: string[]
    }
  >

  /**
   * A list of supported parser names
   */
  printers?: Record<string, {}>

  /**
   * Transform entire ASTs
   *
   * @param ast  The AST to transform
   * @param env  Provides options and mechanisms to sort classes
   */
  transform?(ast: T, env: TransformerEnv): void

  /**
   * Transform entire ASTs
   *
   * @param ast  The AST to transform
   * @param env  Provides options and mechanisms to sort classes
   */
  reprint?(path: AstPath<T>, options: TransformerEnv): void
}
