import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import checker from 'license-checker'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(
  await fs.readFile(path.resolve(__dirname, '../package.json'), 'utf8'),
)

let exclude = [
  'cpy-cli',
  'esbuild',
  'vitest',
  'license-checker',
  'prettier',
  'rimraf',
  'svelte',
  'tsup',
  '@microsoft/api-extractor',
]

/** @type {checker.ModuleInfo} */
let packages = await new Promise((resolve, reject) => {
  checker.init({ start: path.resolve(__dirname, '..') }, (_err, packages) => {
    if (_err) {
      reject(_err)
    } else {
      resolve(packages)
    }
  })
})

for (let key in packages) {
  let dep = packages[key]
  let name = key.split(/(?<=.)@/)[0]

  if (exclude.includes(name)) continue
  if (!dep.licenseFile) continue
  if (!(name in pkg.devDependencies)) continue

  let dir = path.resolve(__dirname, '../dist/licenses', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.copyFile(
    dep.licenseFile,
    path.resolve(dir, path.basename(dep.licenseFile)),
  )
}
