// Given a version, figure out what the release notes are so that we can use this to pre-fill the
// relase notes on a GitHub release for the current version.

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as pkg from '../package.json'

let version = process.argv[2] || process.env.npm_package_version || pkg.version

let changelog = fs.readFileSync(
  path.resolve(__dirname, '..', 'CHANGELOG.md'),
  'utf8',
)
let match = new RegExp(
  `## \\[${version}\\] - (.*)\\n\\n([\\s\\S]*?)\\n(?:(?:##\\s)|(?:\\[))`,
  'g',
).exec(changelog)

if (match) {
  let [, , notes] = match
  console.log(notes.trim())
} else {
  console.log(`Placeholder release notes for version: v${version}`)
}
