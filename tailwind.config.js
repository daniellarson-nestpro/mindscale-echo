/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#050506',
          900: '#0a0a0c',
          850: '#0e0e12',
          800: '#141419',
        },
        echo: {
          mint: '#7ff0c0',
          jade: '#2fd39a',
          deep: '#0b6b52',
          violet: '#a78bfa',
          iris: '#6d5cf6',
        },
      },
      letterSpacing: {
        eyebrow: '0.24em',
      },
      transitionTimingFunction: {
        haptic: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      borderRadius: {
        shell: '2rem',
        core: 'calc(2rem - 0.375rem)',
      },
      maxWidth: {
        page: '1240px',
      },
    },
  },
  plugins: [],
};
