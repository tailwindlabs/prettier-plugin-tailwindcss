// @ts-check
const prettier = require("prettier")

if (!prettier.version.startsWith('2.')) {
  throw new Error(
    "You are running the CJS build of prettier-plugin-tailwindcss which only supports Prettier v2. This should not happen. Please open an issue with a reproduction."
  )
}

module.exports = require('./v2/plugin.js')
