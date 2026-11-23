import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08080D",
          900: "#0B0B12",
          850: "#11111A",
          800: "#15151F",
          700: "#1C1C28",
        },
        lavender: {
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
        },
        neon: {
          400: "#A3FF75",
          500: "#86EFAC",
        },
        muted: "#9999AA",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(167,139,250,0.22), 0 20px 60px -20px rgba(139,92,246,0.35)",
        "glow-green": "0 0 0 1px rgba(163,255,117,0.25), 0 20px 60px -24px rgba(163,255,117,0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(167,139,250,0.35)" },
          "70%": { boxShadow: "0 0 0 10px rgba(167,139,250,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(167,139,250,0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.5s ease both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-ring": "pulseRing 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
