/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'media', // follows device system setting
  theme: {
    extend: {
      colors: {
        brand: {
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6a0a',
          700: '#c2570b',
        },
        // Dark mode surfaces (existing)
        surface: {
          DEFAULT: '#0f1117',
          card:     '#1a1d27',
          elevated: '#21263a',
          border:   '#2a2f45',
        },
        // Light mode surfaces
        'surface-light': {
          DEFAULT:  '#f8f9fb',
          card:     '#ffffff',
          elevated: '#f1f3f7',
          border:   '#e2e6ef',
        },
      },
    },
  },
  plugins: [],
};
