import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// « npm run icons » régénère les icônes de web/public à partir de icon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0d131d' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0d131d' } }
  },
  images: ['web/public/icon.svg']
});
