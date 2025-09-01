import { describe, test } from 'vitest'
import { tests } from './tests.js'
import { format } from './utils.js'

describe('parsers', async () => {
  for (let parser in tests) {
    test(parser, async ({ expect }) => {
      for (let [input, expected, options] of tests[parser]) {
        expect(await format(input, { ...options, parser })).toEqual(expected)
      }
    })
  }
})

describe('other', () => {
  test('non-tailwind classes are sorted to the front', async ({ expect }) => {
    let result = await format('<div class="sm:lowercase uppercase potato text-sm"></div>')

    expect(result).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
  })

  test('parasite utilities (v3)', async ({ expect }) => {
    let result = await format('<div class="group peer unknown-class p-0 container"></div>', {
      tailwindPackageName: 'tailwindcss-v3',
    })

    expect(result).toEqual('<div class="unknown-class group peer container p-0"></div>')
  })
})

describe('whitespace', () => {
  test('class lists containing interpolation are ignored', async ({ expect }) => {
    let result = await format('<div class="{{ this is ignored }}"></div>')

    expect(result).toEqual('<div class="{{ this is ignored }}"></div>')
  })

  test('whitespace can be preserved around classes', async ({ expect }) => {
    let result = await format(`;<div className={' underline text-red-500  flex '}></div>`, {
      parser: 'babel',
      tailwindPreserveWhitespace: true,
    })

    expect(result).toEqual(`;<div className={' flex text-red-500  underline '}></div>`)
  })

  test('whitespace can be collapsed around classes', async ({ expect }) => {
    let result = await format('<div class=" underline text-red-500  flex "></div>')

    expect(result).toEqual('<div class="flex text-red-500 underline"></div>')
  })

  test('whitespace is collapsed but not trimmed when ignored', async ({ expect }) => {
    let result = await format(';<div className={`underline text-red-500 ${foo}-bar flex`}></div>', {
      parser: 'babel',
    })

    expect(result).toEqual(';<div className={`text-red-500 underline ${foo}-bar flex`}></div>')
  })

  test('whitespace is not trimmed inside concat expressions', async ({ expect }) => {
    let result = await format(";<div className={a + ' p-4 ' + b}></div>", {
      parser: 'babel',
    })

    expect(result).toEqual(";<div className={a + ' p-4 ' + b}></div>")
  })

  test('duplicate classes are dropped', async ({ expect }) => {
    let result = await format('<div class="underline line-through underline flex"></div>')

    expect(result).toEqual('<div class="flex underline line-through"></div>')
  })
})

describe('errors', () => {
  test('when the given JS config does not exist', async ({ expect }) => {
    let result = format('<div></div>', {
      tailwindConfig: 'i-do-not-exist.js',
      tailwindPackageName: 'tailwindcss-v3',
    })

    await expect(result).rejects.toThrowError(/Cannot find module/)
  })

  test('when the given stylesheet does not exist', async ({ expect }) => {
    let result = format('<div></div>', {
      tailwindStylesheet: 'i-do-not-exist.css',
      tailwindPackageName: 'tailwindcss-v4',
    })

    await expect(result).rejects.toThrowError(/no such file or directory/)
  })

  test('when using a stylesheet and the local install is not v4', async ({ expect }) => {
    let result = format('<div></div>', {
      tailwindStylesheet: 'i-do-not-exist.css',
      tailwindPackageName: 'tailwindcss-v3',
    })

    await expect(result).rejects.toThrowError(/Unable to load Tailwind CSS v4/)
  })
})
