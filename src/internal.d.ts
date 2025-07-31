import type { PluginOptions } from '.'

export interface InternalOptions extends PluginOptions {
  printer: Printer<any>

  /**
   * The package name to use when loading Tailwind CSS
   */
  tailwindPackageName?: string
}

export interface InternalPlugin {
  name?: string
}

declare module 'prettier' {
  interface RequiredOptions extends InternalOptions {}
  interface ParserOptions extends InternalOptions {}
  interface Plugin<T = any> extends InternalPlugin {}
}
