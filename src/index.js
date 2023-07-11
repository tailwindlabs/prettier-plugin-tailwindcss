// @ts-check
import prettier from "prettier"

if (prettier.version.startsWith('2.')) {
  module.exports = require('./plugin-v2.js')
}
