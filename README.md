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

## Options

### Customizing your Tailwind config path

To ensure that the class sorting takes into consideration any of your project's Tailwind customizations, it needs access to your [Tailwind configuration file](https://tailwindcss.com/docs/configuration) (`tailwind.config.js`).

By default the plugin will look for this file in the same directory as your Prettier configuration file. However, if your Tailwind configuration is somewhere else, you can specify this using the `tailwindConfig` option in your Prettier configuration.

Note that paths are resolved relative to the Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  tailwindConfig: './styles/tailwind.config.js',
}
```

If a local configuration file cannot be found the plugin will fallback to the default Tailwind configuration.

## Sorting in non-standard attributes

By default the plugin will only sort classes found in standard HTML attributes (or their equivalents for each language) like `class`, `className`, `:class`, `[ngClass]`, etc…

To customize this list you can provide a `tailwindAttributes` option which is an array of attribute names to sort. Note that this will override the default list of attributes, so you'll need to include any attributes you want to sort in addition to the defaults:

```js
// prettier.config.js
module.exports = {
  tailwindAttributes: ['class', 'className', 'myClassList']
};
```

With this configuration, the following code will have the `myClassList` attribute sorted in addition to the `class` and `className` attributes:

```jsx
function Button({ isHovering, children }) {
  return (
    <button myClassList="rounded py-2 px-4 text-base bg-blue-500 text-white">
      {children}
    </button>
  );
}
```

This configuration is shared by all languages supported by our plugin, so you can use the same configuration for HTML, JSX, Vue, Angular, etc…

Here's an example using Vue:
```vue
<template>
  <button myClassList="rounded py-2 px-4 text-base bg-blue-500 text-white">
    {{ children }}
  </button>
  <!-- Expressions are automatically supported too -->
  <button :myClassList="{'rounded py-2 px-4 text-base bg-blue-500 text-white': true}">
    {{ children }}
  </button>
</template>
```


## Sorting classes in function calls

When using libraries like `classnames`, `clsx`, or `cva`, you may want to sort classes in strings provided to certain function calls. To do this you can specify a list of function names in the `tailwindFunctions` option in your Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  tailwindFunctions: ['classnames', 'clsx', 'cva']
};
```

With this configuration, the following code will have the `clsx` function call sorted (in addition to `classnames` and `cva`):

```jsx
import clsx from 'clsx';

function Button({ isHovering, children }) {
  let classes = clsx(
    'rounded py-2 px-4 text-base bg-blue-500 text-white',
    {
      'bg-blue-700 text-gray-100': isHovering,
    },
  )

  return (
    <button className={classes}>
      {children}
    </button>
  );
}
```

## Sorting classes in template literals

This plugin also enables sorting of classes using tagged template literals. To enable this you specify a list of tag names in the  `tailwindFunctions` option in your Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  tailwindFunctions: ['tw']
};
```

With the above configuration this example, which uses React Native and [Tailwind React Native Classnames](https://github.com/jaredh159/tailwind-react-native-classnames), will now have the classes sorted for all template literals that are tagged with `tw`:

```jsx
import { View, Text } from 'react-native';
import tw from 'twrnc';

const MyComponent = () => (
  <View style={tw`p-4 bg-white dark:bg-black`}>
    <Text style={tw`text-md text-black dark:text-white`}>Hello World</Text>
  </View>
);
```

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
