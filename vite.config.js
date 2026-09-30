import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/* номер сборки: версия из package.json + коммит + время. Кладётся в код (__BUILD__) и в version.json рядом с сайтом */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
if (!sha) { try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { sha = ''; } }
const time = new Date().toISOString();
const BUILD = { version: pkg.version, sha, time, id: sha + '-' + time };
const versionFile = () => ({
  name: 'version-json',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD) }); }
});

/* base './' — одна сборка работает и на GitHub Pages (https://<user>.github.io/<repo>/), и в Capacitor. */
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: { outDir: 'dist', assetsDir: 'static', target: 'es2020', assetsInlineLimit: 0 },
  plugins: [
    versionFile(),
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
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,jpg,jpeg,webp,gif,ico}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: ({url}) => url.pathname.includes('/assets/') && /\.(png|jpe?g|webp|gif)$/i.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'arts', expiration: { maxEntries: 64 } }
        }]
      }
    })
  ]
});
