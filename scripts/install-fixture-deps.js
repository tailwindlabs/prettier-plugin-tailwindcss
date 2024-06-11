import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fixturesDir = path.resolve(__dirname, '../tests/fixtures')
let fixtureDirs = await fs.readdir(fixturesDir)
let fixtures = fixtureDirs.map((name) => path.join(fixturesDir, name))

await Promise.all(
  fixtures.map(async (fixture) => {
    let exists = await fs.access(path.join(fixture, 'package.json')).then(
      () => true,
      () => false,
    )

    if (!exists) return

    console.log(`Installing dependencies for ${fixture}`)

    await execAsync('npm install', { cwd: fixture })
  }),
)
