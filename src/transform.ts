import type { AstPath, ParserOptions } from 'prettier'
import type { TransformerEnv } from './types'

export function defineTransform<T>(opts: TransformOptions<T>) {
  return opts
}

export interface TransformOptions<T> {
  /**
   * A list of supported parser names
   */
  parsers: Record<
    string,
    {
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
  transform(ast: T, env: TransformerEnv): void

  /**
   * Transform entire ASTs
   *
   * @param ast  The AST to transform
   * @param env  Provides options and mechanisms to sort classes
   */
  reprint?(path: AstPath<T>, options: ParserOptions<T>): void
}
