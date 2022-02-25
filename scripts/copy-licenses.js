const checker = require('license-checker')
const { devDependencies } = require('../package.json')
const fs = require('fs')
const path = require('path')

let exclude = [
  '@tailwindcss/line-clamp',
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
      name in devDependencies &&
      !exclude.includes(name) &&
      packages[key].licenseFile
    ) {
      let dir = path.resolve(__dirname, '../dist/licenses', name)
      fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(
        packages[key].licenseFile,
        path.resolve(dir, path.basename(packages[key].licenseFile))
      )
    }
  }
})
