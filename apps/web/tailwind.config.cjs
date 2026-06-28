/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#09090b',
          raised: '#18181b',
          overlay: '#27272a',
          border: '#3f3f46',
        },
        decision: {
          go: '#16a34a',
          'go-muted': 'rgba(22, 163, 74, 0.12)',
          investigate: '#ca8a04',
          'investigate-muted': 'rgba(202, 138, 4, 0.12)',
          kill: '#dc2626',
          'kill-muted': 'rgba(220, 38, 38, 0.12)',
        },
        status: {
          ready: '#16a34a',
          degraded: '#ca8a04',
          unavailable: '#71717a',
          'not-configured': '#52525b',
          unknown: '#71717a',
        },
        confidence: {
          high: '#16a34a',
          medium: '#ca8a04',
          low: '#dc2626',
        },
        accent: '#a1a1aa',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
}
