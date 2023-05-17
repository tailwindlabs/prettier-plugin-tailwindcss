import { Parser, Printer, SupportOption } from 'prettier';

export interface PluginOptions {
  /**
   * Path to the Tailwind config file
   */
  tailwindConfig?: string

  /**
   * List of functions and template literal tags with arguments that contain classes that should be sorted
   */
  tailwindFunctions: string[]

  /**
   * List of custom attributes that contain classes that should be sorted
   */
  tailwindAttributes: string[]
}

declare module 'prettier' {
  interface RequiredOptions extends PluginOptions {}
  interface ParserOptions extends PluginOptions {}
}

export const options: Record<keyof PluginOptions, SupportOption>
export const parsers: Record<string, Parser>
export const printers: Record<string, Printer>
