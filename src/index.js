// @ts-check
import prettier from "prettier"

if (prettier.version.startsWith('2.')) {
  module.exports = require('./v2/plugin.js')
} else {
  module.exports = require('./v3/plugin.js')
}
