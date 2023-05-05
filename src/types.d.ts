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
  tailwindConfig: string | null
  tailwindFunctions?: string[]
  tailwindAttributes?: string[]
}
