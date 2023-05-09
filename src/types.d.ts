import { ParserOptions, Printer } from 'prettier'

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
  changes: { text: string; loc: any }[]
}

export interface TransformerEnv {
  context: any
  customizations: Customizations
  generateRules: () => any
  parsers: any
  options: any
}

export interface RawOptions {
  tailwindConfig?: string
  tailwindFunctions?: string[]
  tailwindAttributes?: string[]
}

export interface InternalOptions {
  printer: Printer<any>
}

export interface ContextContainer {
  context: any
  generateRules: () => any
  tailwindConfig: any
}

export type PluginOptions = ParserOptions<any> & RawOptions & InternalOptions
