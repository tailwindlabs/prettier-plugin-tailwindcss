import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 10000,
    css: true,
  },

  plugins: [
    {
      name: 'force-inline-css',
      enforce: 'pre',
      resolveId(id) {
        if (!id.endsWith('.css')) return
        if (id.includes('?raw')) return
        return this.resolve(`${id}?raw`)
      },
    },
  ],
})
