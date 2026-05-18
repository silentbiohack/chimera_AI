/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { 950: "#04060b", 900: "#070a13", 800: "#0c1322" },
        cy: {
          50:  "#e6fffb",
          100: "#b3fff1",
          200: "#80f7e3",
          300: "#4be9d2",
          400: "#1fd1bb",
          500: "#0ab59f",
          600: "#079381",
          700: "#067160",
          800: "#054f43",
          900: "#032d26",
        },
        danger: { 500: "#ff3b6e", 600: "#e0234d" },
        warn: { 500: "#ffc857" },
        ink: { 100: "#d8e1f3", 200: "#aab4c8", 300: "#7c8499", 400: "#525a6f" },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(75, 233, 210, 0.45)",
        danger: "0 0 40px -10px rgba(255, 59, 110, 0.55)",
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        scan: "scan 6s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(75,233,210,0.4)" },
          "50%":      { boxShadow: "0 0 32px 4px rgba(75,233,210,0.0)" },
        },
        scan: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
