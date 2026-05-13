import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          3: "var(--bg-3)"
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          card: "var(--color-surface-card)",
          hover: "var(--color-surface-hover)"
        },
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)"
        }
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)"
      },
      keyframes: {
        "task-complete-pop": {
          "0%": { transform: "scale(0.72)", opacity: "0.85" },
          "55%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" }
        }
      },
      animation: {
        "task-complete-pop": "task-complete-pop 0.65s cubic-bezier(0.16, 1, 0.3, 1) both"
      }
    }
  },
  plugins: [tailwindcssAnimate]
} satisfies Config;
