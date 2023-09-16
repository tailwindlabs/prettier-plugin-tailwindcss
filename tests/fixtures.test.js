const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { format, pluginPath } = require('./utils')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function formatFixture(name, extension) {
  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')
  let filePath = path.resolve(__dirname, `fixtures/${name}/index.${extension}`)

  let cmd = `${binPath} ${filePath} --plugin ${pluginPath}`

  return execAsync(cmd).then(({ stdout }) => stdout.trim())
}

let fixtures = [
  {
    name: 'no prettier config',
    dir: 'no-prettier-config',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'inferred config path',
    dir: 'basic',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'inferred config path (.cjs)',
    dir: 'cjs',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using esm config',
    dir: 'esm',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using esm config (explicit path)',
    dir: 'esm-explicit',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using ts config',
    dir: 'ts',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using ts config (explicit path)',
    dir: 'ts-explicit',
    output: '<div class="bg-red-500 sm:bg-hotpink"></div>',
  },
  {
    name: 'using v3.2.7',
    dir: 'v3-2',
    output: '<div class="bg-red-500 sm:bg-tomato"></div>',
  },
  {
    name: 'plugins',
    dir: 'plugins',
    output: '<div class="uppercase foo sm:bar"></div>',
  },
  {
    name: 'customizations: js/jsx',
    dir: 'custom-jsx',
    ext: 'jsx',
    output: `const a = sortMeFn("p-2 sm:p-1");
const b = sortMeFn({
  foo: "p-2 sm:p-1",
});

const c = dontSortFn("sm:p-1 p-2");
const d = sortMeTemplate\`p-2 sm:p-1\`;
const e = dontSortMeTemplate\`sm:p-1 p-2\`;
const f = tw.foo\`p-2 sm:p-1\`;
const g = tw.foo.bar\`p-2 sm:p-1\`;
const h = no.foo\`sm:p-1 p-2\`;
const i = no.tw\`sm:p-1 p-2\`;

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="p-2 sm:p-1" dontSort="sm:p-1 p-2" />;`,
  },
  {
    name: 'customizations: vue',
    dir: 'custom-vue',
    ext: 'vue',
    output: `<script setup>
let a = sortMeFn("p-2 sm:p-1");
let b = sortMeFn({ "p-2 sm:p-1": true });
let c = dontSortFn("sm:p-1 p-2");
let d = sortMeTemplate\`p-2 sm:p-1\`;
let e = dontSortMeTemplate\`sm:p-1 p-2\`;
</script>
<template>
  <div class="p-2 sm:p-1" sortMe="p-2 sm:p-1" dontSortMe="sm:p-1 p-2"></div>
  <div :class="{ 'p-2 sm:p-1': true }"></div>
</template>`,
  },
]

let configs = [
  {
    from: __dirname + '/../.prettierignore',
    to: __dirname + '/../.prettierignore.testing',
  },
  {
    from: __dirname + '/../prettier.config.js',
    to: __dirname + '/../prettier.config.js.testing',
  },
]

test('explicit config path', async () => {
  expect(
    await format('<div class="sm:bg-tomato bg-red-500"></div>', {
      tailwindConfig: path.resolve(
        __dirname,
        'fixtures/basic/tailwind.config.js',
      ),
    }),
  ).toEqual('<div class="bg-red-500 sm:bg-tomato"></div>')
})

describe('fixtures', () => {
  // Temporarily move config files out of the way so they don't interfere with the tests
  beforeAll(() =>
    Promise.all(configs.map(({ from, to }) => fs.promises.rename(from, to))),
  )

  afterAll(() =>
    Promise.all(configs.map(({ from, to }) => fs.promises.rename(to, from))),
  )

  for (const fixture of fixtures) {
    test(fixture.name, async () => {
      let formatted = await formatFixture(fixture.dir, fixture.ext ?? 'html')
      expect(formatted).toEqual(fixture.output)
    })
  }
})
