import type { Config } from "tailwindcss";

// Colours that change with the theme read CSS variables (see app/globals.css).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: v("base-bg"),
          surface: v("base-surface"),
          card: v("base-card"),
          border: v("base-border"),
          hover: v("base-hover"),
        },
        ink: v("ink"),
        gray: {
          50: v("gray-50"), 100: v("gray-100"), 200: v("gray-200"), 300: v("gray-300"), 400: v("gray-400"),
          500: v("gray-500"), 600: v("gray-600"), 700: v("gray-700"), 800: v("gray-800"), 900: v("gray-900"),
        },
        accent: {
          DEFAULT: v("accent"),
          hover: v("accent-hover"),
        },
        status: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#3B82F6",
        },
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
};
export default config;
