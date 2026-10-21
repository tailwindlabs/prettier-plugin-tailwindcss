import { expect, test } from 'vitest'
import { format } from './utils.js'

test.each([
  {
    parser: 'babel',
    input: "clsx(status === 'underline flex' ? 'sm:p-0 p-0' : '')",
    condition: "status === 'underline flex'",
  },
  {
    parser: 'typescript',
    input: "clsx(status === 'underline flex' ? 'sm:p-0 p-0' : '')",
    condition: "status === 'underline flex'",
  },
  {
    parser: 'vue',
    input: `<div :class="status === 'underline flex' ? 'sm:p-0 p-0' : ''"></div>`,
    condition: "status === 'underline flex'",
  },
  {
    parser: 'angular',
    input: `<div [ngClass]="status === 'underline flex' ? 'sm:p-0 p-0' : ''"></div>`,
    condition: "status === 'underline flex'",
  },
  {
    parser: 'glimmer',
    input: '<div class={{if (eq status "underline flex") "sm:p-0 p-0" ""}}></div>',
    condition: "(eq status 'underline flex')",
  },
  {
    parser: 'svelte',
    input: "<div class={status === 'underline flex' ? 'sm:p-0 p-0' : ''}></div>",
    condition: "status === 'underline flex'",
  },
])(
  '$parser preserves conditions while sorting class results',
  async ({ parser, input, condition }) => {
    const result = await format(input, {
      parser,
      tailwindFunctions: ['clsx'],
      plugins: parser === 'svelte' ? ['prettier-plugin-svelte'] : [],
    })

    // Conditions consume exact strings, unlike the class lists selected by their result branches.
    expect(result).toContain(condition)
    expect(result).toContain('p-0 sm:p-0')
  },
)

test('does not reenter class sorters inside a condition', async ({ expect }) => {
  const result = await format(
    "clsx(clsx('underline flex') === status && (<i className={'underline flex'} />).props.className === 'underline flex' ? 'sm:p-0 p-0' : '')",
    { parser: 'babel', tailwindFunctions: ['clsx'] },
  )

  expect(result).toContain("clsx('underline flex') === status")
  expect(result).toContain("className={'underline flex'}")
  expect(result).toContain('p-0 sm:p-0')
})
