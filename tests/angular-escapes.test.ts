import { test } from 'vitest'
import { format } from './utils.js'

test('sorts Angular classes without changing escaped string contents', async ({ expect }) => {
  const input = String.raw`<div [ngClass]="'sm:p-0 \u0070-0' + ' before:content-[\'x\']'"></div>`
  const expected = String.raw`<div [ngClass]="'p-0 sm:p-0' + ' before:content-[\'x\']'"></div>`

  const result = await format(input, { parser: 'angular' })

  expect(result).toBe(expected)
  expect(await format(result, { parser: 'angular' })).toBe(result)
})
