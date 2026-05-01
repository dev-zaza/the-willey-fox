import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2ef',
          100: '#fde0d9',
          200: '#fbc1b3',
          300: '#f88d75',
          400: '#f25434',
          500: '#ea2e00',
          600: '#cc2900',
          700: '#a82200',
          800: '#7d1900',
          900: '#5e1300',
        },
        sage: {
          50: '#f3f7f6',
          100: '#dfeae8',
          200: '#c1d5d1',
          300: '#9dbdb8',
          400: '#7ba49e',
          500: '#5e8a85',
          600: '#4d716c',
          700: '#3e5b57',
          800: '#314744',
          900: '#263634',
        },
        cream: {
          50: '#faf6ee',
          100: '#f0e7d6',
          200: '#e6dcc7',
          300: '#d6c8a8',
        },
        surface: {
          DEFAULT: 'var(--bg-primary)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          border: 'var(--border)',
        },
        accent: {
          DEFAULT: 'var(--admin-primary, #ea2e00)',
          dim: 'var(--admin-primary-dim, rgba(234,46,0,0.12))',
          ring: 'var(--admin-ring, #ea2e00)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        'location-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.7' },
        },
        'destination-beacon': {
          '0%': { transform: 'scale(0.8)', opacity: '0.9' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'drop-marker': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '60%': { transform: 'translateY(4px)', opacity: '1' },
          '80%': { transform: 'translateY(-2px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'location-dot': 'location-dot 2s ease-in-out infinite',
        'destination-beacon': 'destination-beacon 1.5s ease-out infinite',
        'drop-marker': 'drop-marker 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-up': 'fade-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(249,115,22,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.05) 1px, transparent 1px)',
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};

export default config;
