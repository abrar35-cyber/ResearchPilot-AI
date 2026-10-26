import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-naskh)",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec3ff",
          400: "#59a1ff",
          500: "#3380fc",
          600: "#1d61f1",
          700: "#154bde",
          800: "#183db4",
          900: "#1a388d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
