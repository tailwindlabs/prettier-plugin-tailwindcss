# prettier-plugin-tailwindcss

A [Prettier](https://prettier.io/) plugin for Tailwind CSS that automatically sorts classes based on Tailwind's internal class sorting algorithm.

> Note, this plugin is only compatible with Tailwind CSS v3.

## Installation

Install `prettier-plugin-tailwindcss` via npm as a dev-dependency.

```sh
npm install --save-dev prettier prettier-plugin-tailwindcss
```

This plugin follows the Prettier autoloading convention, so once it's installed it should automatically start working.

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

To make this plugin work we had to build it in a way that the Prettier plugin system was not originally designed for. We had to extend the core parsers in Prettier with our own custom parsers. And while this totally works, it makes this plugin incompatible with other Prettier plugins that are built the same way.

One example of this incompatibility is with the [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte) plugin. It's not possible to use the Svelte plugin at the same time as the Tailwind CSS plugin. However, as a workaround for this specific situation, we've bundled the Svelte plugin into our plugin. Simply remove `prettier-plugin-svelte` from your Svelte project when installing the `prettier-plugin-tailwindcss` plugin, and everything should continue working.
