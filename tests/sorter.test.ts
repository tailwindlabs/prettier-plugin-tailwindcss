import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { createSorter } from '../src/lib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('createSorter', () => {
  describe('sortClassAttributes', () => {
    test('sorts with base + relative configPath (v3)', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        filepath: path.join(fixtureDir, 'index.html'),
        configPath: './tailwind.config.js',
      })

      let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('sorts with base + absolute configPath', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let configPath = path.join(fixtureDir, 'tailwind.config.js')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath,
      })

      let sorted = sorter.sortClassAttributes(['p-4 m-2', 'hover:text-red-500 text-blue-500'])
      expect(sorted).toEqual(['m-2 p-4', 'text-blue-500 hover:text-red-500'])
    })

    test('sorts with v4 stylesheet', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/custom-pkg-name-v4')
      let sorter = await createSorter({
        base: fixtureDir,
        stylesheetPath: './app.css',
      })

      let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('preserves whitespace when option is enabled', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
        preserveWhitespace: true,
      })

      let [sorted] = sorter.sortClassAttributes(['  sm:bg-tomato   bg-red-500  '])
      expect(sorted).toBe('  bg-red-500   sm:bg-tomato  ')
    })

    test('collapses whitespace by default', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
      })

      let [sorted] = sorter.sortClassAttributes(['  sm:bg-tomato   bg-red-500  '])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('removes duplicates by default', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
      })

      let [sorted] = sorter.sortClassAttributes(['bg-red-500 sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('preserves duplicates when option is enabled', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
        preserveDuplicates: true,
      })

      let [sorted] = sorter.sortClassAttributes(['bg-red-500 sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 bg-red-500 sm:bg-tomato')
    })
  })

  describe('sortClassLists', () => {
    test('sorts class lists (arrays of class names)', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
      })

      let sorted = sorter.sortClassLists([
        ['sm:bg-tomato', 'bg-red-500'],
        ['p-4', 'm-2'],
      ])

      expect(sorted).toEqual([
        ['bg-red-500', 'sm:bg-tomato'],
        ['m-2', 'p-4'],
      ])
    })

    test('removes duplicates by default', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
      })

      let [sorted] = sorter.sortClassLists([['bg-red-500', 'sm:bg-tomato', 'bg-red-500']])

      expect(sorted).toEqual(['bg-red-500', 'sm:bg-tomato'])
    })

    test('preserves duplicates when option is enabled', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        configPath: './tailwind.config.js',
        preserveDuplicates: true,
      })

      let [sorted] = sorter.sortClassLists([['bg-red-500', 'sm:bg-tomato', 'bg-red-500']])

      expect(sorted).toEqual(['bg-red-500', 'bg-red-500', 'sm:bg-tomato'])
    })
  })

  describe('error handling', () => {
    test('handles auto-detection without explicit config', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/basic')
      let sorter = await createSorter({
        base: fixtureDir,
        filepath: path.join(fixtureDir, 'index.html'),
      })

      let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('works with no tailwind installation (uses bundled)', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/no-local-version')
      let sorter = await createSorter({
        base: fixtureDir,
        stylesheetPath: './app.css',
      })

      let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })

    test('works without a config file (uses default Tailwind config)', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/no-stylesheet-given')
      let sorter = await createSorter({
        base: fixtureDir,
      })

      // Should still sort using default Tailwind order
      let [sorted] = sorter.sortClassAttributes(['p-4 m-2'])
      expect(sorted).toBe('m-2 p-4')
    })
  })

  describe('monorepo support', () => {
    test('resolves tailwind relative to filepath in monorepo', async () => {
      let fixtureDir = path.resolve(__dirname, 'fixtures/monorepo')
      let package1Path = path.join(fixtureDir, 'package-1', 'index.html')

      let sorter = await createSorter({
        base: path.join(fixtureDir, 'package-1'),
        filepath: package1Path,
        stylesheetPath: './app.css',
      })

      let [sorted] = sorter.sortClassAttributes(['sm:bg-tomato bg-red-500'])
      expect(sorted).toBe('bg-red-500 sm:bg-tomato')
    })
  })
})
