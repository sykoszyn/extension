/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./dashboard/**/*.{ts,tsx,html}', './extension/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07080a', 900: '#0c0d10', 850: '#111317', 800: '#16181d', 700: '#1e2128', 600: '#2a2e37', 500: '#3a3f4b' },
        fog: { 100: '#f2f3f5', 300: '#c4c8d0', 400: '#9aa0ac', 500: '#6e7482' },
        ember: { 300: '#ffb38a', 400: '#ff8a4c', 500: '#ff6a1f', 600: '#e5500a', 700: '#b83d05' },
        blood: { 400: '#ff5468', 500: '#ef3346' },
        win: '#3ddc97',
        loss: '#ff5468',
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Bahnschrift"', '"DIN Condensed"', '"Arial Narrow"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite', rise: 'rise .28s ease-out both' },
    },
  },
  plugins: [],
};
