import plugin from 'tailwindcss/plugin'

export default plugin(
  ({ addUtilities }) => {
    addUtilities({
      '.utility-ts-from-plugin': {
        color: 'black'
      },
      '.utility-ts-from-plugin-2': {
        width: '100%',
        height: '100%',
      },
    })
  },
  {
    theme: {
      extend: {
        colors: {
          'ts-from-plugin': 'black',
        },
      },
    },
  },
)
