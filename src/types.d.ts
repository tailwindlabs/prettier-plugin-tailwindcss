import { Printer } from 'prettier'

export interface TransformerMetadata {
  // Default customizations for a given transformer
  staticAttrs?: string[]
  dynamicAttrs?: string[]
  functions?: string[]
}

export interface Customizations {
  functions: Set<string>
  staticAttrs: Set<string>
  dynamicAttrs: Set<string>
}

export interface TransformerContext {
  env: TransformerEnv
  changes: StringChange[]
}

export interface TransformerEnv {
  context: any
  customizations: Customizations
  generateRules: () => any
  parsers: any
  options: any
}

export interface ContextContainer {
  context: any
  generateRules: () => any
}

export interface InternalOptions {
  printer: Printer<any>
}

declare module 'prettier' {
  interface RequiredOptions extends InternalOptions {}
  interface ParserOptions extends InternalOptions {}
}

export interface StringChange {
  start: number
  end: number
  before: string
  after: string
}
