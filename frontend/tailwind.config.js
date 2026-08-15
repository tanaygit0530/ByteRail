/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#070a12',
          800: '#0d1322',
          700: '#161f36',
          600: '#212d4a',
        },
        json: {
          main: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.2)',
          accent: '#ef4444',
        },
        binary: {
          main: '#10b981',
          glow: 'rgba(16, 185, 129, 0.2)',
          accent: '#06b6d4',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
