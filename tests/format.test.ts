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

  test('parasite utilities (v4)', async ({ expect }) => {
    let result = await format('<div class="group peer unknown-class p-0 container"></div>', {
      tailwindPackageName: 'tailwindcss-v4',
    })

    expect(result).toEqual('<div class="group peer unknown-class container p-0"></div>')
  })

  test('parasite utilities (no install == v4)', async ({ expect }) => {
    let result = await format('<div class="group peer unknown-class p-0 container"></div>')

    expect(result).toEqual('<div class="group peer unknown-class container p-0"></div>')
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

  test('whitespace is not trimmed inside concat expressions (angular)', async ({ expect }) => {
    let result = await format(`<ul [class]="'pagination' + (size ? ' pagination-' + size : '')"></ul>`, {
      parser: 'angular',
    })

    expect(result).toEqual(`<ul [class]="'pagination' + (size ? ' pagination-' + size : '')"></ul>`)
  })

  test('whitespace is not trimmed inside adjacent-before/after template expressions', async ({ expect }) => {
    let result = await format(";<div className={`header${isExtendable ? ' header-extendable' : ''}`} />", {
      parser: 'babel',
    })

    expect(result).toEqual(";<div className={`header${isExtendable ? ' header-extendable' : ''}`} />")
  })

  test('whitespace is not trimmed before template literal quasis without leading space', async ({ expect }) => {
    let result = await format(";<div className={`${foo ? 'sm:p-0 p-0 ' : ''}header`}></div>", {
      parser: 'babel',
    })

    expect(result).toEqual(";<div className={`${foo ? 'p-0 sm:p-0 ' : ''}header`}></div>")
  })

  test('duplicate classes are dropped', async ({ expect }) => {
    let result = await format('<div class="underline line-through underline flex"></div>')

    expect(result).toEqual('<div class="flex line-through underline"></div>')
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

    await expect(result).rejects.toThrowError(/no such file or directory/)
  })
})

describe('regex matching', () => {
  test('attribute name exact matches', async ({ expect }) => {
    let result = await format('<div myClass="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['myClass'],
    })

    expect(result).toEqual('<div myClass="p-0 sm:p-0"></div>')
  })

  test('function name exact matches', async ({ expect }) => {
    let result = await format('let classList = tw`sm:p-0 p-0`', {
      parser: 'babel',
      tailwindFunctions: ['tw'],
    })

    expect(result).toEqual('let classList = tw`p-0 sm:p-0`')
  })

  test('attribute name regex matches', async ({ expect }) => {
    let result = await format(`<div data-class="sm:p-0 p-0" data-classes="sm:p-0 p-0" data-style="sm:p-0 p-0"></div>`, {
      tailwindAttributes: ['/data-.*/'],
    })

    expect(result).toEqual(`<div data-class="p-0 sm:p-0" data-classes="p-0 sm:p-0" data-style="p-0 sm:p-0"></div>`)
  })

  test('function name regex matches', async ({ expect }) => {
    let result = await format('let classList1 = twClasses`sm:p-0 p-0`\nlet classList2 = myClasses`sm:p-0 p-0`', {
      parser: 'babel',
      tailwindFunctions: ['/.*Classes/'],
    })

    expect(result).toEqual('let classList1 = twClasses`p-0 sm:p-0`\nlet classList2 = myClasses`p-0 sm:p-0`')
  })

  test('regex flags are supported', async ({ expect }) => {
    let result = await format(`;<div MyClass="sm:p-0 p-0" data-other={MyFn('sm:p-0 p-0')} />`, {
      parser: 'babel',
      tailwindAttributes: ['/myclass/i'],
      tailwindFunctions: ['/myfn/i'],
    })

    expect(result).toEqual(`;<div MyClass="p-0 sm:p-0" data-other={MyFn('p-0 sm:p-0')} />`)
  })

  test('anchors are supported', async ({ expect }) => {
    let result = await format(
      `;<div classList="sm:p-0 p-0" styleList="sm:p-0 p-0" otherList="sm:p-0 p-0" data-other-1={styleList('sm:p-0 p-0')} data-other-2={classList('sm:p-0 p-0')} />`,
      {
        parser: 'babel',
        tailwindAttributes: ['/.*List$/'],
        tailwindFunctions: ['/.*List$/'],
      },
    )

    expect(result).toEqual(
      `;<div classList="p-0 sm:p-0" styleList="p-0 sm:p-0" otherList="p-0 sm:p-0" data-other-1={styleList('p-0 sm:p-0')} data-other-2={classList('p-0 sm:p-0')} />`,
    )
  })

  test('works with Vue dynamic bindings', async ({ expect }) => {
    let result = await format('<div :data-classes="`sm:p-0 p-0`"></div>', {
      parser: 'vue',
      tailwindAttributes: ['/data-.*/'],
    })

    expect(result).toEqual('<div :data-classes="`p-0 sm:p-0`"></div>')
  })

  test('works with Angular property bindings', async ({ expect }) => {
    let result = await format('<div [dataClasses]="`sm:p-0 p-0`"></div>', {
      parser: 'angular',
      tailwindAttributes: ['/data.*/i'],
    })

    expect(result).toEqual('<div [dataClasses]="`p-0 sm:p-0`"></div>')
  })

  test('invalid regex patterns do nothing', async ({ expect }) => {
    let result = await format('<div data-test="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/data-[/'],
    })

    expect(result).toEqual('<div data-test="sm:p-0 p-0"></div>')
  })

  test('dynamic attributes are not matched as static attributes', async ({ expect }) => {
    let result = await format(`<div :custom-class="['sm:p-0 flex underline p-0']"></div>`, {
      parser: 'vue',
      tailwindAttributes: ['/.*-class/'],
    })

    expect(result).toEqual(`<div :custom-class="['flex p-0 underline sm:p-0']"></div>`)
  })

  test('dynamic attributes are not matched as static attributes (2)', async ({ expect }) => {
    let result = await format(`<div :custom-class="['sm:p-0 flex underline p-0']"></div>`, {
      parser: 'vue',
      tailwindAttributes: ['/:custom-class/'],
    })

    expect(result).toEqual(`<div :custom-class="['sm:p-0 flex underline p-0']"></div>`)
  })

  // These tests pass but that is a side-effect of the implementation
  // If these change in the future to no longer pass that is a good thing
  describe('dynamic attribute matching quirks', () => {
    test('Vue', async ({ expect }) => {
      let result = await format('<div ::data-classes="`sm:p-0 p-0`"></div>', {
        parser: 'vue',
        tailwindAttributes: ['/:data-.*/'],
      })

      expect(result).toEqual('<div ::data-classes="`p-0 sm:p-0`"></div>')
    })

    test('Angular', async ({ expect }) => {
      let result = await format('<div [[dataClasses]]="`sm:p-0 p-0`"></div>', {
        parser: 'angular',
        tailwindAttributes: ['/\\[data.*\\]/i'],
      })

      expect(result).toEqual('<div [[dataClasses]]="`p-0 sm:p-0`"></div>')
    })
  })
})
