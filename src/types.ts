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

export interface UnifiedApi {
  getClassOrder(classList: string[]): [string, bigint | null][]
}

export interface TransformerEnv {
  context: UnifiedApi
  matcher: Matcher
  options: ParserOptions
  changes: StringChangePositional[]
}

export interface StringChangePositional {
  start: { line: number; column: number }
  end: { line: number; column: number }
  before: string
  after: string
}

export interface StringChange {
  start: number
  end: number
  before: string
  after: string
}
