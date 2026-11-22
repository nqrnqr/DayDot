import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.daydot.app',
  appName: 'DayDot',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F7F7F8',
  },
};

export default config;
