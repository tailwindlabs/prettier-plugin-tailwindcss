import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { format, pluginPath } from './utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const execAsync = promisify(exec)

let fixtures = [
  {
    name: 'no prettier config',
    dir: 'no-prettier-config',
  },
  {
    name: 'inferred config path',
    dir: 'basic',
  },
  {
    name: 'inferred config path (.cjs)',
    dir: 'cjs',
  },
  {
    name: 'using esm config',
    dir: 'esm',
  },
  {
    name: 'using esm config (explicit path)',
    dir: 'esm-explicit',
  },
  {
    name: 'using ts config',
    dir: 'ts',
  },
  {
    name: 'using ts config (explicit path)',
    dir: 'ts-explicit',
  },
  {
    name: 'using v3.2.7',
    dir: 'v3-2',
  },
  {
    name: 'plugins',
    dir: 'plugins',
  },
  {
    name: 'customizations: js/jsx',
    dir: 'custom-jsx',
    ext: 'jsx',
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

  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')

  for (const { ext = 'html', dir, name } of fixtures) {
    let fixturePath = path.resolve(__dirname, `fixtures/${dir}`)
    test.concurrent(name, async () => {
      let filePath = path.resolve(fixturePath, `index.${ext}`)
      let outputPath = path.resolve(fixturePath, `output.${ext}`)
      let cmd = `${binPath} ${filePath} --plugin ${pluginPath}`
      let formatted = (await execAsync(cmd)).stdout
      let expected = await fs.promises.readFile(outputPath, 'utf-8')
      expect(formatted.trim()).toEqual(expected.trim())
    })
  }
})
