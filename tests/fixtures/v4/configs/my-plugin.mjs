import plugin from 'tailwindcss/plugin'

export default plugin(function ({ addUtilities }) {
  addUtilities({
    '.from-plugin-1': {
      width: '100%',
    },
    '.from-plugin-2': {
      color: 'red',
      margin: '2rem',
    },
  })
})
