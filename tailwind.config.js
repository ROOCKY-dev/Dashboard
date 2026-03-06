/**
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    "./index.html",
    "./dashboard.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6", // tailwind blue-500
        background: {
          light: "#f6f7f8",
          dark: "#0a0f14"
        }
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"]
      }
    },
  },
  darkMode: 'class',
  plugins: [],
}