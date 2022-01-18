# prettier-plugin-tailwindcss

A [Prettier](https://prettier.io/) plugin...

## Installation

> Note that `prettier-plugin-tailwindcss` is only compatible with Tailwind CSS v3

```sh
# Using npm
npm install --save-dev prettier prettier-plugin-tailwindcss

# Using Yarn
yarn add --dev prettier prettier-plugin-tailwindcss
```

By default the plugin will look for a [Tailwind config file (`tailwind.config.js`)](https://tailwindcss.com/docs/configuration) in the same directory as your Prettier config file. If your Tailwind config file is somewhere else you can specify this using the `tailwindConfig` option (paths are resolved relative to the Prettier config file):

```js
// prettier.config.js
module.exports = {
  tailwindConfig: './styles/tailwind.config.js',
}
```

_If a Tailwind config file cannot be found then the default Tailwind configuration will be used._
