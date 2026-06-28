import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],

  /** Load monorepo-root .env so embedded API gets MONGODB_URI, GEMINI_API_KEY, etc. */
  envDir: fileURLToPath(new URL('../..', import.meta.url)),

  runtimeConfig: {
    /** SSR calls the embedded API on the same Nuxt port. */
    apiBaseUrl: process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000',
    public: {
      /** Empty = same-origin — API is mounted at /health and /v1 on this server. */
      apiBaseUrl: process.env['NUXT_PUBLIC_API_BASE_URL'] ?? '',
      maptilerKey: process.env['NUXT_PUBLIC_MAPTILER_KEY'] ?? '',
    },
  },

  nitro: {
    externals: {
      inline: ['@solux/api', '@solux/shared', '@solux/config', '@solux/geo-utils'],
    },
  },

  app: {
    head: {
      title: 'Solux — Fatal-Flaw Screening',
      meta: [
        {
          name: 'description',
          content: 'Evidence-backed fatal-flaw screening for solar and storage site selection',
        },
        { name: 'theme-color', content: '#09090b' },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://unpkg.com/maplibre-gl@4.7.0/dist/maplibre-gl.css',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  typescript: {
    strict: true,
  },

  compatibilityDate: '2025-06-27',

  experimental: {
    scanPageMeta: false,
    typedPages: false,
  },
})
