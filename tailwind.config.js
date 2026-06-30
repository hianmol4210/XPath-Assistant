/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          DEFAULT: '#1e1e2e',
          mid: '#252536',
          light: '#2a2a3c',
        },
        text: {
          DEFAULT: '#e2e8f0',
          muted: '#94a3b8',
        },
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
};
