/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // включаем поддержку тёмной темы через класс
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}