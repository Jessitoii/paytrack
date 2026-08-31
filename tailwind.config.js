/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#090D16",
        card: "#111827",
        cardBorder: "#1F2937",
        primary: "#10B981", // Fintech green
        primaryDark: "#059669",
        accent: "#3B82F6",
        textMain: "#F9FAFB",
        textMuted: "#9CA3AF",
      },
    },
  },
  plugins: [],
};
