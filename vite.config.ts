import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Velavan Transport',
        short_name: 'Velavan',
        description: 'Fleet tracking and expenses for Velavan Transport',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
        ],
      },
    }),
  ],
})
