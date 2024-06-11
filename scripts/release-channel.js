// Given a version, figure out what the release channel is so that we can publish to the correct
// channel on npm.
//
// E.g.:
//
//   1.2.3                  -> latest (default)
//   0.0.0-insiders.ffaa88  -> insiders
//   4.1.0-alpha.4          -> alpha
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(
  await fs.readFile(path.resolve(__dirname, '../package.json'), 'utf8'),
)

let version = process.argv[2] || process.env.npm_package_version || pkg.version

let match = /\d+\.\d+\.\d+-(.*)\.\d+/g.exec(version)
if (match) {
  console.log(match[1])
} else {
  console.log('latest')
}
