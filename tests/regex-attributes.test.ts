import { describe, test } from 'vitest'
import { format } from './utils.js'

describe('regex attribute matching', () => {
  test('matches attributes using exact string', async ({ expect }) => {
    let result = await format('<div myClass="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['myClass'],
    })

    expect(result).toEqual('<div myClass="p-0 sm:p-0"></div>')
  })

  test('matches attributes using simple regex pattern', async ({ expect }) => {
    let result = await format('<div data-class="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/data-.*/'],
    })

    expect(result).toEqual('<div data-class="p-0 sm:p-0"></div>')
  })

  test('matches multiple attributes with regex pattern', async ({ expect }) => {
    let result = await format(`<div data-class="sm:p-0 p-0" data-classes="sm:p-0 p-0" data-style="sm:p-0 p-0"></div>`, {
      tailwindAttributes: ['/data-.*/'],
    })

    expect(result).toEqual(`<div data-class="p-0 sm:p-0" data-classes="p-0 sm:p-0" data-style="p-0 sm:p-0"></div>`)
  })

  test('matches attributes with case-insensitive regex', async ({ expect }) => {
    let result = await format('<div MyClass="sm:p-0 p-0" myclass="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/myclass/i'],
    })

    expect(result).toEqual('<div MyClass="p-0 sm:p-0" myclass="p-0 sm:p-0"></div>')
  })

  test('combines exact match and regex pattern', async ({ expect }) => {
    let result = await format('<div class="sm:p-0 p-0" data-class="sm:p-0 p-0" customClass="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['customClass', '/data-.*/'],
    })

    expect(result).toEqual('<div class="p-0 sm:p-0" data-class="p-0 sm:p-0" customClass="p-0 sm:p-0"></div>')
  })

  test('regex pattern with specific endings', async ({ expect }) => {
    let result = await format('<div classList="sm:p-0 p-0" styleList="sm:p-0 p-0" otherList="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/.*List$/'],
    })

    expect(result).toEqual('<div classList="p-0 sm:p-0" styleList="p-0 sm:p-0" otherList="p-0 sm:p-0"></div>')
  })

  test('works with JSX components', async ({ expect }) => {
    let result = await format(';<Component dataClass="sm:p-0 p-0" />', {
      parser: 'babel',
      tailwindAttributes: ['/data.*/'],
    })

    expect(result).toEqual(';<Component dataClass="p-0 sm:p-0" />')
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

  test('matches with word boundaries', async ({ expect }) => {
    let result = await format('<div className="sm:p-0 p-0" myClassName="sm:p-0 p-0" classNames="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/\\bclass\\b/i'],
    })

    // Does not match since we're looking for exact word "class"
    expect(result).toEqual('<div className="sm:p-0 p-0" myClassName="sm:p-0 p-0" classNames="sm:p-0 p-0"></div>')
  })

  test('matches with OR patterns', async ({ expect }) => {
    let result = await format('<div styles="sm:p-0 p-0" classes="sm:p-0 p-0" other="sm:p-0 p-0"></div>', {
      tailwindAttributes: ['/(styles|classes)/'],
    })

    expect(result).toEqual('<div styles="p-0 sm:p-0" classes="p-0 sm:p-0" other="sm:p-0 p-0"></div>')
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
