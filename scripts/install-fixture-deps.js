const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

let fixturesDir = path.resolve(__dirname, '../tests/fixtures')
let fixtures = fs
  .readdirSync(fixturesDir)
  .map((name) => path.join(fixturesDir, name))

for (let fixture of fixtures) {
  if (fs.existsSync(path.join(fixture, 'package.json'))) {
    execSync('npm install', { cwd: fixture })
  }
}
