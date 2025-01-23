import plugin from 'tailwindcss/plugin'

export default plugin(
  ({ addUtilities }) => {
    addUtilities({
      '.utility-esm-from-plugin': {
        color: 'black'
      },
      '.utility-esm-from-plugin-2': {
        width: '100%',
        height: '100%',
      },
    })
  },
  {
    theme: {
      extend: {
        colors: {
          'esm-from-plugin': 'black',
        },
      },
    },
  },
)
