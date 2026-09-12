import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mathogram/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/mathogram/',
        name: 'Mathogram',
        short_name: 'Mathogram',
        description:
          'Little sums, lovely discoveries. Pixel animals in English and Czech.',
        start_url: '/mathogram/',
        scope: '/mathogram/',
        display: 'standalone',
        theme_color: '#fff8ec',
        background_color: '#fff8ec',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'mathogram',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: '/mathogram/index.html',
        navigateFallbackAllowlist: [/^\/mathogram(?:\/|$)/],
        skipWaiting: false,
        clientsClaim: true,
      },
    }),
  ],
  build: { target: 'es2022' },
});
