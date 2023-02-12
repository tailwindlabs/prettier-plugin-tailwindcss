<img src="https://raw.githubusercontent.com/tailwindlabs/prettier-plugin-tailwindcss/main/.github/banner.jpg" alt="prettier-plugin-tailwindcss" />

A [Prettier](https://prettier.io/) plugin for Tailwind CSS v3.0+ that automatically sorts classes based on [our recommended class order](https://tailwindcss.com/blog/automatic-class-sorting-with-prettier#how-classes-are-sorted).

## Installation

To get started, just install `prettier-plugin-tailwindcss` as a dev-dependency:

```sh
npm install -D prettier prettier-plugin-tailwindcss
```

This plugin follows Prettier’s autoloading convention, so as long as you’ve got Prettier set up in your project, it’ll start working automatically as soon as it’s installed.

_Note that plugin autoloading is not supported when using certain package managers, such as pnpm or Yarn PnP. In this case you may need to add the plugin to your Prettier config explicitly:_

```js
// prettier.config.js
module.exports = {
  plugins: [require('prettier-plugin-tailwindcss')],
}
```

## Usage Example

Before `prettier-plugin-tailwindcss`, common errors like having 2 padding classes can easily be missed:

```html
<div className="m-2 flex-row justify-between p-4 align-bottom p-2">
  <!-- context -->
</div>
```

With `prettier-plugin-tailwindcss` installed, the classes are sorted, placing both padding classes next to each other making it much easier to find and correct:

```html
<div className="m-2 flex-row justify-between p-4 p-2 align-bottom">
  <!-- context -->
</div>
```


## Resolving your Tailwind configuration

To ensure that the class sorting is taking into consideration any of your project's Tailwind customizations, it needs access to your [Tailwind configuration file](https://tailwindcss.com/docs/configuration) (`tailwind.config.js`).

By default the plugin will look for this file in the same directory as your Prettier configuration file. However, if your Tailwind configuration is somewhere else, you can specify this using the `tailwindConfig` option in your Prettier configuration.

Note that paths are resolved relative to the Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  tailwindConfig: './styles/tailwind.config.js',
}
```

If a local configuration file cannot be found the plugin will fallback to the default Tailwind configuration.

## Compatibility with other Prettier plugins

This plugin uses Prettier APIs that can only be used by one plugin at a time, making it incompatible with other Prettier plugins implemented the same way. To solve this we've added explicit per-plugin workarounds that enable compatibility with the following Prettier plugins:

- `@prettier/plugin-php`
- `@prettier/plugin-pug`
- `@shopify/prettier-plugin-liquid`
- `@ianvs/prettier-plugin-sort-imports`
- `@trivago/prettier-plugin-sort-imports`
- `prettier-plugin-astro`
- `prettier-plugin-css-order`
- `prettier-plugin-import-sort`
- `prettier-plugin-jsdoc`
- `prettier-plugin-organize-attributes`
- `prettier-plugin-organize-imports`
- `prettier-plugin-style-order`
- `prettier-plugin-svelte`
- `prettier-plugin-twig-melody`

One limitation with this approach is that `prettier-plugin-tailwindcss` *must* be loaded last, meaning Prettier auto-loading needs to be disabled. You can do this by setting the `pluginSearchDirs` option to `false` and then listing each of your Prettier plugins in the `plugins` array:

```json5
// .prettierrc
{
  // ..
  "plugins": [
    "prettier-plugin-svelte",
    "prettier-plugin-organize-imports",
    "prettier-plugin-tailwindcss" // MUST come last
  ],
  "pluginSearchDirs": false
}
```

## VSCode

VSCode has multiple ways to format with Prettier and `prettier-plugin-tailwindcss`.

### Formating Methods
To ensure Prettier and `prettier-plugin-tailwindcss` sorts classes, add one of the following to settings.json:

```js
// .vscode/settings.json
{
  // ..
  "editor.formatOnSave": true  //Sort classes on save
  "editor.formatOnPaste": true //Sort classes on paste
  "editor.formatOnType": true  //Sort classes while typing
}
```

### Automatic Sorting
Automatic sorting of Tailwind classes in VSCode can be very useful to save time and improve code quality. To enable automatic sorting, add the following auto-save feature to settings.json:

```js
// .vscode/settings.json
{
  // ..
  "editor.formatOnSave": true,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
}
```

_Note that this automatically saves the file you are currently editing every 1000ms_