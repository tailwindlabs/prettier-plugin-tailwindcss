import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let fixturesDir = path.resolve(__dirname, '../tests/fixtures')
let fixtures = fs
  .readdirSync(fixturesDir)
  .map((name) => path.join(fixturesDir, name))

for (let fixture of fixtures) {
  if (fs.existsSync(path.join(fixture, 'package.json'))) {
    execSync('npm install', { cwd: fixture })
  }
}
