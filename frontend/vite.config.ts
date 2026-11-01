import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'brand/logo-full.png', 'brand/logo-mark.png'],
      manifest: {
        name: 'PixiContes', short_name: 'PixiContes', description: 'Crée tes propres histoires avec Pixi le dragon',
        lang: 'fr', start_url: '/', scope: '/', display: 'fullscreen', orientation: 'any',
        background_color: "#f3f2fa", theme_color: "#6a6ad0",
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        runtimeCaching: [
          // Histoires déjà créées : lisibles hors-ligne (réseau d'abord, repli sur le cache).
          { urlPattern: ({ url, request }) => request.method === 'GET' && /^\/api\/(stories|characters|config)/.test(url.pathname) && !url.pathname.endsWith('/pdf'),
            handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 4, expiration: { maxEntries: 200 } } },
          { urlPattern: ({ url }) => url.pathname.startsWith('/media/images/'), handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 400 } } },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8080', '/media': 'http://localhost:8080' } },
});
