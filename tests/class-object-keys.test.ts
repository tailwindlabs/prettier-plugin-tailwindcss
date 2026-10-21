import { expect, test } from 'vitest'
import { format } from './utils.js'

test.each(['babel', 'typescript', 'vue', 'angular', 'svelte'])(
  '%s preserves conditional key identities and sorts collision-free keys',
  async (parser) => {
    // Angular does not support computed object keys, but shares the static-key writer.
    const uncertainObjects =
      parser === 'angular'
        ? ''
        : "{ 'underline flex': true, ...flags }, { 'underline flex': true, [key]: false }, " +
          "{ 'flex underline': true, ...{ 'underline flex': false } }, "
    const expression =
      "[{ 'underline flex': true, 'flex underline': false }, " +
      uncertainObjects +
      "{ 'sm:p-0 p-0': enabled }]"
    const input =
      parser === 'vue'
        ? `<div :class="${expression}"></div>`
        : parser === 'angular'
          ? `<div [ngClass]="${expression}"></div>`
          : parser === 'svelte'
            ? `<div class={${expression}}></div>`
            : `clsx(${expression})`
    const result = await format(input, {
      parser,
      tailwindFunctions: ['clsx'],
      plugins: parser === 'svelte' ? ['prettier-plugin-svelte'] : [],
    })

    expect(result.match(/'underline flex': true/g)).toHaveLength(parser === 'angular' ? 1 : 3)
    if (parser !== 'angular') expect(result).toContain("'underline flex': false")
    expect(result).toContain("'p-0 sm:p-0': enabled")
  },
)

test('retains object-key context across global sorter entries', async ({ expect }) => {
  const result = await format(
    "clsx([{ 'flex underline': true, ...identity({ 'underline flex': false }) }, { 'underline flex': true, [(<i className={'underline flex'} />).props.className]: false }])",
    { parser: 'babel', tailwindFunctions: ['clsx', 'identity'] },
  )

  expect(result).toContain("identity({ 'underline flex': false })")
  expect(result).toContain("className={'underline flex'}")
})

test('keeps collision plans valid across nested whitespace scopes', async ({ expect }) => {
  const result = await format(
    "<div className={'x' + clsx({ ' underline flex': true, 'flex underline': false })} />",
    { parser: 'babel', tailwindFunctions: ['clsx'] },
  )

  expect(result).toContain("' flex underline': true")
  expect(result).toContain("'flex underline': false")
})

test('compares serialized keys when escapes and cooked order differ', async ({ expect }) => {
  const result = await format(
    String.raw`clsx({"sm:p-0 flex\tblock p-0": true, "flex\tblock p-0 sm:p-0": false})`,
    { parser: 'babel', tailwindFunctions: ['clsx'] },
  )

  expect(result).toContain(String.raw`sm:p-0 flex\tblock p-0`)
})

test('preserves duplicate identities when raw escapes would split them', async ({ expect }) => {
  const result = await format(
    String.raw`clsx({ 'underline flex': true, '\u0075nderline flex': false })`,
    { parser: 'babel', tailwindFunctions: ['clsx'] },
  )

  expect(result).toContain("'underline flex': true")
})
