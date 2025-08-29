const plugin = require("tailwindcss-v3/plugin");

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
