export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/tailwindcss'],

  runtimeConfig: {
    apiBaseUrl: process.env['API_BASE_URL'] ?? 'http://localhost:3001',
    public: {
      apiBaseUrl: process.env['NUXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3001',
      maptilerKey: process.env['NUXT_PUBLIC_MAPTILER_KEY'] ?? '',
      googleMapsKey: process.env['NUXT_PUBLIC_GOOGLE_MAPS_KEY'] ?? '',
    },
  },

  app: {
    head: {
      title: 'Solux — Solar Site Screening',
      meta: [
        { name: 'description', content: 'AI fatal-flaw screening for solar development sites' },
        { name: 'theme-color', content: '#0f172a' },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://unpkg.com/maplibre-gl@4.7.0/dist/maplibre-gl.css',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
  },

  compatibilityDate: '2024-11-01',
})
