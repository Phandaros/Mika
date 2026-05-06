import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          orange: "var(--color-brand-orange)",
          black: "var(--color-brand-black)",
          white: "var(--color-brand-white)"
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          card: "var(--color-surface-card)",
          hover: "var(--color-surface-hover)"
        },
        border: "var(--color-border)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
