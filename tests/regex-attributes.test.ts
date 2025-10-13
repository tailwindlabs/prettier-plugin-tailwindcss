import { describe, test } from 'vitest'
import { format } from './utils.js'

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
    let result = await format('<div :data-classes="sm:p-0 p-0"></div>', {
      parser: 'vue',
      tailwindAttributes: ['/data-.*/'],
    })

    expect(result).toEqual('<div :data-classes="p-0 sm:p-0"></div>')
  })

  test('works with Angular property bindings', async ({ expect }) => {
    let result = await format('<div [dataClasses]="sm:p-0 p-0"></div>', {
      parser: 'angular',
      tailwindAttributes: ['/data.*/i'],
    })

    expect(result).toEqual('<div [dataClasses]="p-0 sm:p-0"></div>')
  })

  test('invalid regex patterns do nothing', async ({ expect }) => {
    let result = await format('<div data-test="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/data-[/'],
    })

    expect(result).toEqual('<div data-test="sm:p-0 p-0"></div>')
  })

  // These tests pass but that is a side-effect of the implementation
  // If these change in the future to no longer pass that is a good thing
  describe('dynamic attribute matching quirks', () => {
    test('Vue', async ({ expect }) => {
      let result = await format('<div ::data-classes="sm:p-0 p-0"></div>', {
        parser: 'vue',
        tailwindAttributes: ['/:data-.*/'],
      })

      expect(result).toEqual('<div ::data-classes="p-0 sm:p-0"></div>')
    })

    test('Angular', async ({ expect }) => {
      let result = await format('<div [[dataClasses]]="sm:p-0 p-0"></div>', {
        parser: 'angular',
        tailwindAttributes: ['/\\[data.*\\]/i'],
      })

      expect(result).toEqual('<div [[dataClasses]]="p-0 sm:p-0"></div>')
    })
  })
})
