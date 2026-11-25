import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE_PATH || '/';
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const CAPACITOR_SW_KILL_SWITCH = `// Self-destructing Service Worker for native Capacitor Android builds.
// Replaces any legacy Workbox sw.js left over from early APK installs (v1.0.3-v1.0.8),
// clears stale CacheStorage (leaving IndexedDB and localStorage untouched),
// unregisters itself, and reloads open windows onto the active native/OTA bundle.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}
      try {
        await self.registration.unregister();
      } catch {}
      try {
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clients) {
          if ('navigate' in client) {
            const target = new URL('/', client.url);
            target.searchParams.set('_sw_reset', String(Date.now()));
            await client.navigate(target.href).catch(() => {});
          }
        }
      } catch {}
    })(),
  );
});
`;

function capacitorSwKillSwitchPlugin(): Plugin {
  return {
    name: 'daydot-capacitor-sw-kill-switch',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: CAPACITOR_SW_KILL_SWITCH,
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    ...(!isCapacitorBuild
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
            manifest: {
              name: 'DayDot · 日迹',
              short_name: 'DayDot',
              lang: 'zh-CN',
              description: '轻量、无压力的 Done List 与生活事件记录工具',
              theme_color: '#F5F6F8',
              background_color: '#F5F6F8',
              display: 'standalone',
              orientation: 'portrait',
              start_url: base,
              scope: base,
              icons: [
                {
                  src: 'icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'icon.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            },
          }),
        ]
      : [capacitorSwKillSwitchPlugin()]),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
