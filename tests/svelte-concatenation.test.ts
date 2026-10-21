import { test } from 'vitest'
import { format } from './utils.js'

test('preserves attached Svelte class fragments while sorting complete tokens', async ({
  expect,
}) => {
  const result = await format(
    "<div class={'inline-' + (active ? 'underline flex block ' : `underline flex block `) + 'tail'}></div>",
    {
      parser: 'svelte',
      plugins: ['prettier-plugin-svelte'],
    },
  )

  expect(result).toBe(
    "<div class={'inline-' + (active ? 'underline block flex ' : `underline block flex `) + 'tail'}></div>",
  )
})
