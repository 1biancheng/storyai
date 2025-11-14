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
        // 使用CSS变量定义的颜色系统
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          lighter: 'var(--primary-lighter)',
          lightest: 'var(--primary-lightest)',
        },
        // Accent color
        accent: 'var(--accent)',
        // Danger colors
        danger: {
          DEFAULT: 'var(--danger)',
          dark: 'var(--danger-dark)',
        },
        // Background colors from CSS variables
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        // Text colors from CSS变量
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        // Border colors
        'border-color': 'var(--border-color)',
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