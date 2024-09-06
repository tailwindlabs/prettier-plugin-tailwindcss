import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, test } from 'vitest'
import { format, pluginPath } from './utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const execAsync = promisify(exec)

let fixtures = [
  {
    name: 'no prettier config',
    dir: 'no-prettier-config',
    ext: 'html',
  },
  {
    name: 'inferred config path',
    dir: 'basic',
    ext: 'html',
  },
  {
    name: 'inferred config path (.cjs)',
    dir: 'cjs',
    ext: 'html',
  },
  {
    name: 'using esm config',
    dir: 'esm',
    ext: 'html',
  },
  {
    name: 'using esm config (explicit path)',
    dir: 'esm-explicit',
    ext: 'html',
  },
  {
    name: 'using ts config',
    dir: 'ts',
    ext: 'html',
  },
  {
    name: 'using ts config (explicit path)',
    dir: 'ts-explicit',
    ext: 'html',
  },
  {
    name: 'using v3.2.7',
    dir: 'v3-2',
    ext: 'html',
  },
  {
    name: 'plugins',
    dir: 'plugins',
    ext: 'html',
  },
  {
    name: 'customizations: js/jsx',
    dir: 'custom-jsx',
    ext: 'jsx',
  },

  {
    name: 'v4: basic formatting',
    dir: 'v4/basic',
    ext: 'html',
  },
  {
    name: 'v4: configs and plugins',
    dir: 'v4/configs',
    ext: 'html',
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

test.concurrent('explicit config path', async ({ expect }) => {
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
  beforeAll(async () => {
    await Promise.all(configs.map(({ from, to }) => fs.rename(from, to)))
  })

  afterAll(async () => {
    await Promise.all(configs.map(({ from, to }) => fs.rename(to, from)))
  })

  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')

  for (const { ext, dir, name } of fixtures) {
    let fixturePath = path.resolve(__dirname, `fixtures/${dir}`)
    let inputPath = path.resolve(fixturePath, `index.${ext}`)
    let outputPath = path.resolve(fixturePath, `output.${ext}`)
    let cmd = `${binPath} ${inputPath} --plugin ${pluginPath}`

    test.concurrent(name, async ({ expect }) => {
      let results = await execAsync(cmd)
      let formatted = results.stdout
      let expected = await fs.readFile(outputPath, 'utf-8')

      expect(formatted.trim()).toEqual(expected.trim())
    })
  }
})
