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
        // Primary colors matching App.css
        primary: {
          DEFAULT: '#52a1a0',
          light: '#51adaa',
          lighter: '#50b8b3',
          lightest: '#4ecdc4',
        },
        dark: {
          primary: {
            DEFAULT: '#4ecdc4',
            light: '#50b8b3',
            lighter: '#51adaa',
            lightest: '#52a1a0',
          },
        },
        // Accent color
        accent: '#c7f464',
        // Danger colors
        danger: {
          DEFAULT: '#ff6b6b',
          dark: '#c44d58',
        },
        // Background colors from App.css
        'bg-primary': '#ffffff',
        'bg-secondary': '#f3f4f6',
        'bg-tertiary': '#e5e7eb',
        dark: {
          'bg-primary': '#121212',
          'bg-secondary': '#1e1e1e',
          'bg-tertiary': '#2d2d2d',
        },
        // Text colors from App.css
        'text-primary': '#111827',
        'text-secondary': '#4b5563',
        'text-tertiary': '#9ca3af',
        dark: {
          'text-primary': '#ffffff',
          'text-secondary': '#d1d5db',
          'text-tertiary': '#9ca3af',
        },
        // Border colors
        'border-color': '#e5e7eb',
        dark: {
          'border-color': 'rgba(255, 255, 255, 0.1)',
        },
        // Additional semantic colors
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
        // Status colors
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
    },
  },
  plugins: [],
}