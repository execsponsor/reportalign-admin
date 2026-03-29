/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Admin portal uses a dark indigo/slate theme — distinct from main app's navy/green
        admin: {
          bg: '#0f172a',       // slate-900
          surface: '#1e293b',  // slate-800
          card: '#334155',     // slate-700
          border: '#475569',   // slate-600
          text: '#e2e8f0',     // slate-200
          muted: '#94a3b8',    // slate-400
          accent: '#6366f1',   // indigo-500
          'accent-hover': '#818cf8', // indigo-400
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
