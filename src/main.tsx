import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App';

// Inside native Android APK, remove any leftover Service Worker from older builds
// so APK upgrades and OTA hot updates always load fresh local assets.
if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then(async (regs) => {
      if (regs.length === 0) return;
      const hadController = Boolean(navigator.serviceWorker.controller);
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (hadController) {
        window.location.reload();
      }
    })
    .catch(() => {
      // Non-fatal
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
