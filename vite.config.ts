import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-semfundo.png', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Atlas Ponto — RFeitosa Group',
        short_name: 'Atlas Ponto',
        description: 'Módulo de registro de ponto eletrônico PWA com resiliência offline',
        theme_color: '#0A192F',
        background_color: '#0A192F',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/logo-semfundo.png',
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Necessário para as rotas client-side (/login, /forgot-password, /reset-password)
        // resolverem para o index.html quando abertas offline ou via deep link (ex: link de e-mail).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ]
})
