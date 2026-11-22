import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.daydot.app',
  appName: 'DayDot',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F7F7F8',
  },
  plugins: {
    CapacitorUpdater: {
      // Self-hosted manual OTA via GitHub Pages (no third-party cloud calls)
      autoUpdate: false,
      statsUrl: '',
    },
  },
};

export default config;
