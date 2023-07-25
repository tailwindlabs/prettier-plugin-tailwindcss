const prettier = require("prettier")

module.exports = {
  plugins: prettier.version.startsWith('2.')
    ? ['../../../dist/index.js']
    : ['../../../dist/index.mjs'],
}
