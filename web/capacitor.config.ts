import type { CapacitorConfig } from '@capacitor/cli';

// Empaqueta la PWA como app nativa. Ver MANUAL.md → "Apps para Android e iOS".
const config: CapacitorConfig = {
  appId: 'world.sportryn.app',
  appName: 'Sportryn',
  webDir: '.output/public',
  backgroundColor: '#0A0E0D',
};

export default config;
