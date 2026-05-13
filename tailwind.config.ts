import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sheet: {
          border: "#e2e3e3",
          header: "#f8f9fa",
          headerBorder: "#dadce0",
          selected: "#1a73e8",
          rowAlt: "#f8f9fa",
          error: "#fce8e6",
          errorText: "#c5221f",
          valid: "#e6f4ea",
          validText: "#137333",
        },
      },
      fontFamily: {
        sheet: ["Arial", "Roboto", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
