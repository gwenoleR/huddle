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
import LaunchVideo from './LaunchVideo.vue';

export default {
  extends: DefaultTheme,
  // The launch video, right after the home pages' header: it only plays when someone clicks it.
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(LaunchVideo) }),
  enhanceApp({ app }) {
    app.component('Screens', Screens);
    app.component('Steps', Steps);
  }
} satisfies Theme;
