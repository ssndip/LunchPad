import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        manifestFilename: 'manifest.webmanifest',
        includeAssets: [],
        manifest: {
          id: '/lunchpad-kiosk/',
          name: 'LunchPad Kiosk',
          short_name: 'LunchPad',
          description: 'Premium Kiosk & Order Management System for modern dining.',
          categories: ['food', 'productivity', 'business'],
          theme_color: '#171717',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // The three public bootstrap endpoints. These are what a kiosk needs
            // to show a menu after a cold reload with the network down, so they
            // are deliberately kept on disk. None of them carries personal data.
            {
              urlPattern: ({ url }) =>
                url.pathname === '/api/init' ||
                url.pathname === '/api/status' ||
                url.pathname.startsWith('/api/menu'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'lunchpad-bootstrap',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24
                },
                cacheableResponse: {
                  statuses: [200]
                }
              }
            },
            // Every other API response is answered from the network or not at
            // all. The rule below used to be a single `/.*/ ` NetworkFirst, so
            // /api/cards, /api/cards/:rfid/profile, /api/orders, /api/history
            // and /api/analytics were all written to a persistent cache keyed
            // only by URL — cardholder names, balances and order history left
            // on the disk of every kiosk and manager tablet for a day, readable
            // after logout and served back whenever the device went offline.
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Answer for any Host header, so the dev server can be reached through
      // the reverse proxy in front of it (APP_URL) and not just on localhost.
      // Vite otherwise 403s every request whose Host it does not recognise,
      // including the HTML document — which looks like the whole app is down,
      // while an already-open tab keeps working from the service worker's
      // precache of the last `dist/` build and hides the fact.
      //
      // Dev only, and it cannot leak into production: server.ts mounts Vite's
      // middleware exclusively when NODE_ENV is neither "production" nor
      // "test", and the production image serves static files out of dist/ with
      // vite left behind in devDependencies. Nothing here affects who may
      // reach the admin dashboard — that is adminWhitelistGuard plus the PIN,
      // both of which run on every request regardless of this setting.
      //
      // What it does give up is Vite's own host check, which exists to blunt
      // DNS rebinding against a developer's machine. Accepted deliberately:
      // this dev server is meant to be reachable at a real hostname.
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
