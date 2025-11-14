/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#52a1a0',
          light: '#51adaa',
          lighter: '#50b8b3',
          lightest: '#4ecdc4',
        },
        accent: '#c7f464',
        danger: {
          DEFAULT: '#ff6b6b',
          dark: '#c44d58',
        },
        dark: {
          800: '#121212',
          700: '#1e1e1e',
          600: '#2d2d2d',
          500: '#3a3a3a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}