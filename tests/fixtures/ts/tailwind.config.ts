import type { Config } from "tailwindcss";

export default {
  content: ["index.html"],
  theme: {
    extend: {
      colors: {
        hotpink: "hotpink",
      },
    },
  },
} satisfies Config;
