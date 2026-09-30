import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/* base './' — одна сборка работает и на GitHub Pages (https://<user>.github.io/<repo>/), и в Capacitor. */
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsDir: 'static', target: 'es2020', assetsInlineLimit: 0 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*', 'assets/*'],
      manifest: {
        name: 'Тренировки',
        short_name: 'Тренировки',
        description: 'Дневник тренировок: журнал, каталог упражнений, уровни силы и прогноз',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0B10',
        theme_color: '#0A0B10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        /* приложение, шрифты и арты из public/assets кэшируются для офлайна */
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,jpg,jpeg,webp,ico}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: ({url}) => url.pathname.includes('/assets/') && /\.(png|jpe?g|webp)$/i.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'arts', expiration: { maxEntries: 64 } }
        }]
      }
    })
  ]
});
