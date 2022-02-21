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

To make this plugin work we had to use private Prettier APIs that can only be used by a single plugin at once. This means this plugin is incompatible with other Prettier plugins that are using the same APIs.

The most popular example we know of is [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte), which can't be installed at the same time as the Tailwind CSS plugin.

To work around this, we've bundled `prettier-plugin-svelte` directly into `prettier-plugin-tailwindcss`, so if you'd like to use this plugin with Svelte, just uninstall `prettier-plugin-svelte` and everything should work as expected.

If you discover any other incompatibilities, please share them in [this issue](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/issues/31) and hopefully we can figure out a way to make it work.
