import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
})

const _module = await jiti.import(new URL('../src/index.ts', import.meta.url).href, {
  default: true,
})

export default _module?.default ?? _module
