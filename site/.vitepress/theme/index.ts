import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './custom.css';
import Screens from './Screens.vue';
import Steps from './Steps.vue';
import HeroVideo from './HeroVideo.vue';

export default {
  extends: DefaultTheme,
  // The launch video takes the hero image's place on the home pages.
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-image': () => h(HeroVideo) }),
  enhanceApp({ app }) {
    app.component('Screens', Screens);
    app.component('Steps', Steps);
  }
} satisfies Theme;
