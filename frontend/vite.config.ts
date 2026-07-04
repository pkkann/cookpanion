import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ship SW updates automatically; no "new version" prompt to build.
      registerType: 'autoUpdate',
      // Static assets to precache alongside the built bundle.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cookpanion',
        short_name: 'Cookpanion',
        description: 'Plan meals, track your kitchen, and cook with what you have.',
        lang: 'en',
        theme_color: '#c75d3c',
        background_color: '#faf6f1',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA deep links resolve to the app shell when offline...
        navigateFallback: '/index.html',
        // ...except API calls, which must always hit the network.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
