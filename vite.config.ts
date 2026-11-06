import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'web',
  // Version gravée dans l'interface au build (hash du commit en CI), comparée à celle du serveur.
  define: { __APP_VERSION__: JSON.stringify((process.env.APP_VERSION ?? 'dev').slice(0, 7)) },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/logos': 'http://localhost:3000'
    }
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      // Le manifeste est servi par le serveur (/manifest.webmanifest) : nom et langue de l'instance.
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      }
    })
  ]
});
