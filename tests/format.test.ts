import { describe, test } from 'vitest'
import type { TestEntry } from './utils.js'
import { format, no, t, yes } from './utils.js'

let html: TestEntry[] = [
  t`<div class="${yes}"></div>`,
  t`<!-- <div class="${no}"></div> -->`,
  t`<div class="${no} {{ 'p-0 sm:p-0 m-0' }}"></div>`,
  t`<div not-class="${no}"></div>`,
  ['<div class="  sm:p-0   p-0 "></div>', '<div class="p-0 sm:p-0"></div>'],
  t`<div class></div>`,
  t`<div class=""></div>`,
  // Ensure duplicate classes are removed
  ['<div class="sm:p-0 p-0 p-0"></div>', '<div class="p-0 sm:p-0"></div>'],
  // Duplicates are not removed for unknown classes
  [
    '<div class="idonotexist sm:p-0 p-0 idonotexist p-0 idonotexist"></div>',
    '<div class="idonotexist idonotexist idonotexist p-0 sm:p-0"></div>',
  ],
  // Ensure duplicate can be kept
  [
    '<div class="sm:p-0 p-0 p-0"></div>',
    '<div class="p-0 p-0 sm:p-0"></div>',
    {
      tailwindPreserveDuplicates: true,
    },
  ],
]

let css: TestEntry[] = [
  t`@apply ${yes};`,
  t`/* @apply ${no}; */`,
  t`@not-apply ${no};`,
  [
    '@apply sm:p-0\n   p-0;',
    '@apply p-0\n   sm:p-0;',
    { tailwindPreserveWhitespace: true },
  ],
]

let javascript: TestEntry[] = [
  t`;<div class="${yes}" />`,
  t`;<div ns:class="${no}" />`,
  t`/* <div class="${no}" /> */`,
  t`// <div class="${no}" />`,
  t`;<div not-class="${no}" />`,
  t`;<div class={\`${yes}\`} />`,
  t`;<div class={\`${yes} \${'${yes}'} \${'${yes}' ? '${yes}' : '${yes}'}\`} />`,
  t`;<div class={'${yes}'} />`,
  t`;<div class={'${yes}' + '${yes}'} />`,
  t`;<div class={'${yes}' ? '${yes}' + '${yes}' : '${yes}'} />`,
  t`;<div class={clsx('${yes}', ['${yes}'])} />`,
  t`;<div class={clsx({ '${yes}': '${yes}' })} />`,
  t`;<div class={{ '${yes}': '${yes}' }['${yes}']} />`,
  t`;<div class />`,
  t`;<div class="" />`,
  [
    `;<div class={\`sm:block inline flex\${someVar}\`} />`,
    `;<div class={\`inline sm:block flex\${someVar}\`} />`,
  ],
  [
    `;<div class={\`\${someVar}sm:block md:inline flex\`} />`,
    `;<div class={\`\${someVar}sm:block flex md:inline\`} />`,
  ],
  [
    `;<div class={\`sm:p-0 p-0 \${someVar}sm:block md:inline flex\`} />`,
    `;<div class={\`p-0 sm:p-0 \${someVar}sm:block flex md:inline\`} />`,
  ],
  [
    `;<div class="block px-1\u3000py-2" />`,
    `;<div class="px-1\u3000py-2 block" />`,
  ],

  // Whitespace is normalized and duplicates are removed
  [
    ';<div class="   m-0  sm:p-0  p-0   " />',
    ';<div class="m-0 p-0 sm:p-0" />',
  ],
  [
    ";<div class={'   m-0  sm:p-0  p-0   '} />",
    ";<div class={'m-0 p-0 sm:p-0'} />",
  ],
  [';<div class={` sm:p-0\n  p-0   `} />', ';<div class={`p-0 sm:p-0`} />'],
  [';<div class="flex flex" />', ';<div class="flex" />'],
  [';<div class={`   flex  flex `} />', ';<div class={`flex`} />'],
  [
    ';<div class={`   flex  flex flex${someVar}block block`} />',
    ';<div class={`flex flex${someVar}block block`} />',
  ],
  [
    ';<div class={`flex ` + `text-red-500`} />',
    ';<div class={`flex ` + `text-red-500`} />',
  ],
  [
    ';<div class={`flex ` + `  ` + `text-red-500`} />',
    ';<div class={`flex ` + ` ` + `text-red-500`} />',
  ],

  t`;<div class={"before:content-['\\\\2248']"} />`,
  t`;<div class={\`before:content-['\\\\2248']\`} />`,
  t`;<div class="before:content-['\\\\2248']" />`,

  [
    `;<div class={'object-cover' + (standalone ? ' aspect-square w-full' : ' min-h-0 grow basis-0')}></div>`,
    `;<div class={'object-cover' + (standalone ? ' aspect-square w-full' : ' min-h-0 grow basis-0')}></div>`,
  ],
]
javascript = javascript.concat(
  javascript.map((test) => [
    test[0].replace(/class/g, 'className'),
    test[1].replace(/class/g, 'className'),
    test[2],
  ]),
)

let vue: TestEntry[] = [
  ...html,
  t`<div :class="'${yes}'"></div>`,
  t`<!-- <div :class="'${no}'"></div> -->`,
  t`<div :class></div>`,
  t`<div :class=""></div>`,
  t`<div :class="'${yes}' + '${yes}'"></div>`,
  t`<div :class="['${yes}', '${yes}']"></div>`,
  t`<div :class="[cond ? '${yes}' : '${yes}']"></div>`,
  t`<div :class="[someVar ?? '${yes}']"></div>`,
  t`<div :class="{ '${yes}': true }"></div>`,
  t`<div :class="clsx('${yes}')"></div>`,
  t`<div :class="\`${yes}\`"></div>`,
  t`<div :class="\`${yes} \${someVar}\`"></div>`,
  t`<div :class="someVar! ? \`${yes}\` : \`${yes}\`"></div>`, // ts
  t`<div :class="someVar ? someFunc(someVar as string) + '${yes}' : ''"></div>`, // ts
  [
    `<div :class="\`sm:block inline flex\${someVar}\`"></div>`,
    `<div :class="\`inline sm:block flex\${someVar}\`"></div>`,
  ],
  [
    `<div :class="\`\${someVar}sm:block md:inline flex\`"></div>`,
    `<div :class="\`\${someVar}sm:block flex md:inline\`"></div>`,
  ],
  [
    `<div :class="\`sm:p-0 p-0 \${someVar}sm:block md:inline flex\`"></div>`,
    `<div :class="\`p-0 sm:p-0 \${someVar}sm:block flex md:inline\`"></div>`,
  ],

  [`<div :class="'   flex  flex '"></div>`, `<div :class="'flex'"></div>`],
  [`<div :class="\`   flex  flex \`"></div>`, `<div :class="\`flex\`"></div>`],
  [
    `<div :class="' flex ' + ' underline '"></div>`,
    `<div :class="'flex ' + ' underline'"></div>`,
  ],
  [
    `<div :class="' sm:p-5 ' + ' flex ' + ' underline ' + ' sm:m-5 '"></div>`,
    `<div :class="'sm:p-5 ' + ' flex' + ' underline' + ' sm:m-5'"></div>`,
  ],

  [
    `<div :class="'before:content-[\\'\\\\2248\\']'" />`,
    `<div :class="'before:content-[\\'\\\\2248\\']'" />`,
  ],
]

let glimmer: TestEntry[] = [
  t`<div class='${yes}'></div>`,
  t`<!-- <div class='${no}'></div> -->`,
  t`<div class='${yes} {{"${yes}"}}'></div>`,
  t`<div class='${yes} {{"${yes}"}} ${yes}'></div>`,
  t`<div class='${yes} {{"${yes}"}} {{if someVar "${yes}" "${yes}"}}'></div>`,
  t`<div class='${yes} {{"${yes}"}} {{if someVar "${yes}" "${yes}"}}' {{if someVar "attr='${no}'" "attr='${no}'"}}></div>`,
  [
    `<div class='md:inline flex sm:block{{someVar}}'></div>`,
    `<div class='flex md:inline sm:block{{someVar}}'></div>`,
  ],
  [
    `<div class='sm:p-0 p-0 {{someVar}}sm:block md:inline flex'></div>`,
    `<div class='p-0 sm:p-0 {{someVar}}sm:block flex md:inline'></div>`,
  ],
  t`<div not-class='${no}'></div>`,
  ["<div class='  sm:p-0   p-0 '></div>", "<div class='p-0 sm:p-0'></div>"],
  t`<div class></div>`,
  t`<div class=''></div>`,
  t`{{link 'Some page' href=person.url class='${no}'}}`,
  t`<div class='{{if @isTrue (concat "border-l-4 border-" @borderColor)}}'></div>`,
  [
    `<div class='{{if @isTrue (concat "border-opacity-30 border-l-4 border-" @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (concat "border-l-4 border-opacity-30 border-" @borderColor)}}'></div>`,
  ],
  [
    `<div class='{{if @isTrue (concat "border-l-4 border " @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (concat "border border-l-4 " @borderColor)}}'></div>`,
  ],
  [
    `<div class='{{if @isTrue (nope "border-l-4 border-" @borderColor)}}'></div>`,
    `<div class='{{if @isTrue (nope "border- border-l-4" @borderColor)}}'></div>`,
  ],

  [`<div class='flex  flex '></div>`, `<div class='flex'></div>`],

  [
    `<div class='sm:p-0   p-0  p-0 {{someVar}}sm:block flex md:inline   flex '></div>`,
    `<div class='p-0 sm:p-0 {{someVar}}sm:block flex md:inline'></div>`,
  ],
]

let tests: Record<string, TestEntry[]> = {
  html,
  glimmer,
  lwc: html,
  vue: [
    ...vue,
    t`<div :class="\`${yes} \${someVar} ${yes} \${'${yes}'}\`"></div>`,
  ],
  angular: [
    ...html,
    t`<div [ngClass]="'${yes}'"></div>`,
    t`<!-- <div [ngClass]="'${no}'"></div> -->`,
    t`<div [ngClass]></div>`,
    t`<div [ngClass]=""></div>`,
    t`<div [ngClass]="'${yes}' + '${yes}'"></div>`,
    t`<div [ngClass]="['${yes}', '${yes}']"></div>`,
    t`<div [ngClass]="[cond ? '${yes}' : '${yes}']"></div>`,
    t`<div [ngClass]="[someVar ?? '${yes}']"></div>`,
    t`<div [ngClass]="{ '${yes}': true }"></div>`,
    t`<div [ngClass]="clsx('${yes}')"></div>`,
    t`<div [ngClass]="{ '${yes}': (some.thing | urlPipe: { option: true } | async), '${yes}': true }"></div>`,
    t`<div [ngClass]="{ '${yes}': foo && bar?.['baz'] }" class="${yes}"></div>`,

    [
      `<div [ngClass]="' flex ' + ' underline ' + ' block '"></div>`,
      `<div [ngClass]="'flex ' + ' underline' + ' block'"></div>`,
    ],

    // TODO: Enable this test — it causes console noise but not a failure
    // t`<div [ngClass]="{ '${no}': foo && definitely&a:syntax*error }" class="${yes}"></div>`,
  ],
  css: [...css, t`@apply ${yes} !important;`],
  scss: [
    ...css,
    t`@apply ${yes} #{!important};`,
    t`@apply ${yes} #{'!important'};`,
    t`@apply ${yes} #{"!important"};`,

    // These shouldn't ever be used but they are valid
    // syntax so we might as well not break them
    t`@apply ${yes} #{""!important""};`,
    t`@apply ${yes} #{'''!important'''};`,
    t`@apply ${yes} #{"'"'"!important"'"'"};`,
  ],
  less: [...css, t`@apply ${yes} !important;`],
  babel: javascript,
  typescript: javascript,
  'babel-ts': javascript,
  flow: javascript,
  'babel-flow': javascript,
  acorn: javascript,
  meriyah: javascript,
  mdx: javascript
    .filter((test) => {
      return !/^\/\*/.test(test[0]) && !/^\/\*/.test(test[1])
    })
    .map((test) => [
      test[0].replace(/^;/, ''),
      test[1].replace(/^;/, ''),
      test[2],
    ]),
}

describe('parsers', () => {
  for (let parser in tests) {
    test(parser, async ({ expect }) => {
      for (let [input, expected, options] of tests[parser]) {
        expect(await format(input, { ...options, parser })).toEqual(expected)
      }
    })
  }
})

describe('other', () => {
  test('non-tailwind classes', async ({ expect }) => {
    expect(
      await format('<div class="sm:lowercase uppercase potato text-sm"></div>'),
    ).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
  })

  test('parasite utilities', async ({ expect }) => {
    expect(
      await format(
        '<div class="group peer unknown-class p-0 container"></div>',
      ),
    ).toEqual('<div class="unknown-class group peer container p-0"></div>')
  })
})

describe('whitespace', () => {
  test('class lists containing interpolation are ignored', async ({
    expect,
  }) => {
    let result = await format('<div class="{{ this is ignored }}"></div>')
    expect(result).toEqual('<div class="{{ this is ignored }}"></div>')
  })

  test('whitespace can be preserved around classes', async ({ expect }) => {
    let result = await format(
      `;<div className={' underline text-red-500  flex '}></div>`,
      {
        parser: 'babel',
        tailwindPreserveWhitespace: true,
      },
    )
    expect(result).toEqual(
      `;<div className={' flex text-red-500  underline '}></div>`,
    )
  })

  test('whitespace can be collapsed around classes', async ({ expect }) => {
    let result = await format(
      '<div class=" underline text-red-500  flex "></div>',
    )
    expect(result).toEqual('<div class="flex text-red-500 underline"></div>')
  })

  test('whitespace is collapsed but not trimmed when ignored', async ({
    expect,
  }) => {
    let result = await format(
      ';<div className={`underline text-red-500 ${foo}-bar flex`}></div>',
      {
        parser: 'babel',
      },
    )
    expect(result).toEqual(
      ';<div className={`text-red-500 underline ${foo}-bar flex`}></div>',
    )
  })

  test('duplicate classes are dropped', async ({ expect }) => {
    let result = await format(
      '<div class="underline line-through underline flex"></div>',
    )
    expect(result).toEqual('<div class="flex underline line-through"></div>')
  })
})
