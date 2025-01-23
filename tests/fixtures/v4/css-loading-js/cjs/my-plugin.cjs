const plugin = require('tailwindcss/plugin')

module.exports = plugin(
  ({ addUtilities }) => {
    addUtilities({
      '.utility-cjs-from-plugin': {
        color: 'black'
      },
      '.utility-cjs-from-plugin-2': {
        width: '100%',
        height: '100%',
      },
    })
  },
  {
    theme: {
      extend: {
        colors: {
          'cjs-from-plugin': 'black',
        },
      },
    },
  },
)
