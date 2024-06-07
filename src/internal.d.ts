export interface InternalOptions {
  printer: Printer<any>
}

export interface InternalPlugin {
  name?: string
}

declare module 'prettier' {
  interface RequiredOptions extends InternalOptions {}
  interface ParserOptions extends InternalOptions {}
  interface Plugin<T = any> extends InternalPlugin {}
}
