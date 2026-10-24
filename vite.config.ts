import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: './', // Relative Pfade, damit die App sowohl unter /Zeiterfassung-App/ als auch auf localhost/Subpfaden sofort lädt
  plugins: [
    react(),
    {
      name: 'serve-dev-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/index.dev.html';
          }
          next();
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Zeiterfassung Radiologie',
        short_name: 'Zeiterfassung',
        description: 'Professionelle Zeiterfassung & Stundenzettel für Radiologie & Klinikpersonal',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5 MiB
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.dev.html')
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['chart.js', 'chartjs-plugin-datalabels'],
          'vendor-pdf': ['jspdf'],
          'vendor-excel': ['exceljs'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
});
