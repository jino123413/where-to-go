import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'where-to-go',
  web: {
    host: '0.0.0.0',
    port: 3020,
    commands: {
      dev: 'rsbuild dev',
      build: 'rsbuild build',
    },
  },
  permissions: [],
  outdir: 'dist',
  brand: {
    displayName: '운명의 나침반',
    icon: 'https://raw.githubusercontent.com/jino123413/app-logos/master/where-to-go.png',
    primaryColor: '#0D9488',
    bridgeColorMode: 'basic',
  },
  webViewProps: {
    type: 'partner',
  },
});
