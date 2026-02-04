import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { createSorter } from '../src/lib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('createSorter', () => {
  test('sorts with base + relative configPath', async () => {
    let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
    let sorter = await createSorter({
      base: fixtureDir,
      filepath: path.join(fixtureDir, 'index.html'),
      configPath: './tailwind.config.js',
    })

    let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
    expect(sorted).toBe('bg-red-500 sm:bg-tomato')
  })

  test('infers base from formatterConfigPath', async () => {
    let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
    let sorter = await createSorter({
      formatterConfigPath: path.join(fixtureDir, 'prettier.config.js'),
      filepath: path.join(fixtureDir, 'index.html'),
      configPath: './tailwind.config.js',
    })

    let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
    expect(sorted).toBe('bg-red-500 sm:bg-tomato')
  })
})
