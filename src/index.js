// @ts-check
import prettier from "prettier"

if (prettier.version.startsWith('2.')) {
  throw new Error(
    "This plugin only supports Prettier v3+"
  )
}

export * from './plugin.js'
