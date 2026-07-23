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
        theme_color: '#ffffff',
        background_color: '#f6f7f2',
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
    // The dev server sits behind the nginx proxy, so requests arrive with the
    // external Host header (localhost, a LAN IP, a tunnel domain, …). Accept
    // them all rather than maintaining an allowlist.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
