# @tailwindcss/prettier

```
npm install --save-dev prettier @tailwindcss/prettier
```

```js
// prettier.config.js
module.exports = {
  plugins: ['@tailwindcss/prettier'],
}
```

By default the plugin will look for a [Tailwind config file](https://tailwindcss.com/docs/configuration) in the same directory as your Prettier config file. If your config file is somewhere else you can specify this using the `tailwindConfig` option (paths are resolved relative to the Prettier config file):

```js
// prettier.config.js
module.exports = {
  plugins: ['@tailwindcss/prettier'],
  tailwindConfig: './css/tailwind.config.js',
}
```

_If a Tailwind config file cannot be found then the default Tailwind configuration will be used._
