import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE_PATH || '/';
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

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
      : []),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
