import { test } from 'vitest'
import { format } from './utils.js'

test('keeps separators required by enclosing Vue class concatenations', async ({ expect }) => {
  const result = await format(`<div :class="('inline ' + 'sm:p-0 p-0 ') + 'block'"></div>`, {
    parser: 'vue',
  })

  expect(result).toBe(`<div :class="'inline ' + 'p-0 sm:p-0 ' + 'block'"></div>`)
})
