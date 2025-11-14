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
        // CSS Variables based color system matching App.css
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          light: 'rgb(var(--primary-light) / <alpha-value>)',
          lighter: 'rgb(var(--primary-lighter) / <alpha-value>)',
          lightest: 'rgb(var(--primary-lightest) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          dark: 'rgb(var(--danger-dark) / <alpha-value>)',
        },
        // Background colors from App.css
        bg: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
        },
        // Text colors from App.css
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        // Border colors
        border: 'rgb(var(--border-color) / <alpha-value>)',
        // Legacy dark colors for compatibility
        dark: {
          800: '#121212',
          700: '#1e1e1e',
          600: '#2d2d2d',
          500: '#3a3a3a',
        },
        // Additional semantic colors from App.css
        gray: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#495057',
          700: '#343a40',
          800: '#212529',
          900: '#1a1a1a',
        },
        // Status colors matching App.css
        yellow: {
          100: '#fff3cd',
          900: '#856404',
        },
        green: {
          100: '#d4edda',
          900: '#155724',
        },
        blue: {
          500: '#1976d2',
          900: '#1e3a8a',
        },
        purple: {
          100: '#f3e5f5',
          900: '#7b1fa2',
          800: '#4a148c',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      backgroundColor: {
        'dark-800': '#121212',
        'dark-700': '#1e1e1e',
        'dark-600': '#2d2d2d',
        'dark-500': '#3a3a3a',
      },
      borderColor: {
        'white-10': 'rgba(255, 255, 255, 0.1)',
      },
      textColor: {
        'white-10': 'rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}