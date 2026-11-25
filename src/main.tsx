import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initNativeUpdater, isNativeAndroid } from './services/otaUpdater';

// Inside native Android APK, remove any leftover Service Worker from older builds
// so APK upgrades and OTA hot updates always load fresh local assets.
async function initAndroid(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const worker = navigator.serviceWorker;
      const registrations = await worker.getRegistrations();
      const wasControlled = Boolean(worker.controller);
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if (registrations.length > 0 && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if (wasControlled) {
        window.location.reload();
        return;
      }
    } catch {
      // Non-fatal
    }
  }
  await initNativeUpdater();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isNativeAndroid()) void initAndroid();
