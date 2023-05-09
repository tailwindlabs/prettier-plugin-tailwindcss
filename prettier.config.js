/** @type {import('prettier').Config} */
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  pluginSearchDirs: false,
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: ['^@', '^[a-zA-Z0-9-]+', '^[./]'],
}
