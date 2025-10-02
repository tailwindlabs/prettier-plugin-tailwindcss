// @ts-ignore
import index from 'tailwindcss-v4/index.css'
// @ts-ignore
import preflight from 'tailwindcss-v4/preflight.css'
// @ts-ignore
import theme from 'tailwindcss-v4/theme.css'
// @ts-ignore
import utilities from 'tailwindcss-v4/utilities.css'

export const assets: Record<string, string> = {
  tailwindcss: index,
  'tailwindcss/index': index,
  'tailwindcss/index.css': index,

  'tailwindcss/preflight': preflight,
  'tailwindcss/preflight.css': preflight,

  'tailwindcss/theme': theme,
  'tailwindcss/theme.css': theme,

  'tailwindcss/utilities': utilities,
  'tailwindcss/utilities.css': utilities,
}
