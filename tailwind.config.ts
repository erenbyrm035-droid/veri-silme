import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tema tokenlarına bağlı (globals.css). Açık/koyu otomatik uyum sağlar.
        ink: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          soft: "rgb(var(--surface-2) / <alpha-value>)",
          card: "rgb(var(--surface) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
        },
        // Ön plan (metin) — açık/koyu temada okunur kalır.
        fg: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          bright: "rgb(var(--brand-bright) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
        },
        coral: {
          DEFAULT: "rgb(var(--coral) / <alpha-value>)",
          soft: "#ff8a70",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
