const plugin = require("tailwindcss/plugin");

module.exports = {
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".foo": { color: "red" },
        ".bar": { color: "blue" },
      });
    }),
  ],
};
