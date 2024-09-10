import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import glob from 'fast-glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fixtures = glob.sync(
  ['tests/fixtures/*/package.json', 'tests/fixtures/v4/*/package.json'],
  {
    cwd: path.resolve(__dirname, '..'),
  },
)

const execAsync = promisify(exec)

await Promise.all(
  fixtures.map(async (fixture) => {
    console.log(`Installing dependencies for ${fixture}`)

    await execAsync('npm install', { cwd: path.dirname(fixture) })
  }),
)
