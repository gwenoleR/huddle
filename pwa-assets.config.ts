import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// "npm run icons" regenerates the icons in web/public from icon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0d131d' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0d131d' } }
  },
  images: ['web/public/icon.svg']
});
