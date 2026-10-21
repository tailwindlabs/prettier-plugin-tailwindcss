import { expect, test } from 'vitest'
import { format } from './utils.js'

test.each([
  [
    '<div class={{concat "sm:p-0 p-0 " "block"}}></div>',
    '<div class={{concat "p-0 sm:p-0 " "block"}}></div>',
  ],
  [
    '<div class={{if ok (concat "inline-" "underline flex block ") ""}}></div>',
    '<div class={{if ok (concat "inline-" "underline block flex ") ""}}></div>',
  ],
  [
    "<div class=\"{{if ok 'sm:p-0 p-0 ' 'flex '}}underline\"></div>",
    "<div class=\"{{if ok 'p-0 sm:p-0 ' 'flex '}}underline\"></div>",
  ],
])('preserves composed Glimmer class tokens in %s', async (input, expected) => {
  expect(await format(input, { parser: 'glimmer', singleQuote: false })).toBe(expected)
})
