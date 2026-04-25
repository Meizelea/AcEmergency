/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Adding your exact Figma colors here
        'emergency-red': '#b35d5d',
        'sidebar-dark': '#2d2d2d',
        'active-red': '#ff3b3b',
      }
    },
  },
  plugins: [],
}