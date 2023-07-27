// @ts-check
import prettier from "prettier"

if (prettier.version.startsWith('2.')) {
  throw new Error(
    "You are running the ESM build of prettier-plugin-tailwindcss which only supports Prettier v3+. This should not happen. Please open an issue with a reproduction."
  )
}

export * from './plugin.js'
