import type { ParserOptions } from 'prettier'
import type { Matcher } from './options'

export interface TransformerMetadata {
  // Default customizations for a given transformer
  functions?: string[]
  staticAttrs?: string[]
  dynamicAttrs?: string[]
}

export interface Customizations {
  functions: Set<string>
  staticAttrs: Set<string>
  dynamicAttrs: Set<string>
  staticAttrsRegex: RegExp[]
  dynamicAttrsRegex: RegExp[]
  functionsRegex: RegExp[]
}

export interface TransformerContext {
  env: TransformerEnv
  changes: StringChange[]
}

export interface UnifiedApi {
  getClassOrder(classList: string[]): [string, bigint | null][]
}

export interface TransformerEnv {
  context: UnifiedApi
  matcher: Matcher
  parsers: any
  options: ParserOptions
}

export interface StringChange {
  start: number
  end: number
  before: string
  after: string
}
