import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/gangho-bigeup/',
  build: { outDir: 'dist', assetsInlineLimit: 8192 },
  server: { host: true },
  define: {
    __APP_VERSION__: JSON.stringify((process.env.GITHUB_SHA || 'local').slice(0, 7)),
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '강호비급 — 무명행',
        short_name: '강호비급',
        description: '초식을 모아 강호를 등반하는 비공식·비영리 팬메이드 덱빌딩 로그라이크',
        lang: 'ko',
        theme_color: '#141110',
        background_color: '#141110',
        display: 'standalone',
        orientation: 'any',
        scope: '/gangho-bigeup/',
        start_url: '/gangho-bigeup/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webp,woff2}'],
        navigateFallback: '/gangho-bigeup/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
