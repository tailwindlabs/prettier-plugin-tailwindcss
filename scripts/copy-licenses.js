import * as fs from 'node:fs'
import * as path from 'node:path'
import checker from 'license-checker'
import * as pkg from '../package.json'

let exclude = [
  'cpy-cli',
  'esbuild',
  'jest',
  'license-checker',
  'prettier',
  'rimraf',
  'svelte',
]

checker.init({ start: path.resolve(__dirname, '..') }, (_err, packages) => {
  for (let key in packages) {
    let name = key.split(/(?<=.)@/)[0]
    if (
      name in pkg.devDependencies &&
      !exclude.includes(name) &&
      packages[key].licenseFile
    ) {
      let dir = path.resolve(__dirname, '../dist/licenses', name)
      fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(
        packages[key].licenseFile,
        path.resolve(dir, path.basename(packages[key].licenseFile)),
      )
    }
  }
})
