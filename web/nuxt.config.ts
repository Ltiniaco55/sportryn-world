// Sportryn World — frontend (PWA). Se genera como web estática (SPA) para poder
// servirla en cualquier hosting y empaquetarla con Capacitor para Android / iOS.
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,
  modules: ['@vite-pwa/nuxt'],
  // En Docker sobre Windows los cambios de archivo no se notifican: se detectan por sondeo.
  vite: { server: { watch: process.env.NUXT_POLLING ? { usePolling: true, interval: 500 } : undefined } },
  css: [
    '@fontsource/space-grotesk/500.css', '@fontsource/space-grotesk/700.css',
    '@fontsource/inter/400.css', '@fontsource/inter/500.css', '@fontsource/inter/700.css',
    'maplibre-gl/dist/maplibre-gl.css',
    '~/assets/css/main.css',
  ],
  runtimeConfig: {
    public: {
      // URL de la API. Se cambia con la variable NUXT_PUBLIC_API_BASE al construir.
      apiBase: 'http://localhost:8000',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Sportryn',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0A0E0D' },
        { name: 'description', content: 'Ligas y torneos de fútbol amateur: calendario, resultados, clasificación y stickers para compartir.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Sportryn', short_name: 'Sportryn', lang: 'es',
      description: 'Ligas y torneos de fútbol amateur.',
      theme_color: '#0A0E0D', background_color: '#0A0E0D', display: 'standalone', orientation: 'portrait', start_url: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    generateSW: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    devOptions: { enabled: false },
  },
});
