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

## Customizing where classes are sorted

Customization options are provided in order to enable you to expand where this plugin searches for classes to sort. These are entirely optional and are not necessary unless you're doing something special or if you're using certain Tailwind-related or Tailwind-adjacent libraries.

Each of these customization options is a prettier setting which consumes a list of strings. You may also use regular expressions by starting any string with a `^`.

### JSX props

By default the plugin will only try to sort JSX props named `class` or `className`.

This can be customized by specifying a `tailwindJSXProps` option in your Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  // Additionally sort classes found inside JSX props named tw=""
  tailwindJSXProps: ['class', 'className', 'tw']
};
```

### Javascript function calls

By default this plugin does not look at strings inside function calls. This can be enabled by specifying a list of function names in the `tailwindFunctionCalls` option in your Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  // Sort strings found inside calls to functions named cva()
  tailwindFunctionCalls: ['cva']
};
```

### Tagged template literals

By default this plugin does not look inside tagged template literals. This can be enabled by specifying a list of function names in the `tailwindTaggedTemplates` option in your Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  // Sort template strings found in tagged template literal calls named tw``
  tailwindTaggedTemplates: ['tw']
};
```
