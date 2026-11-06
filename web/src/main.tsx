import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './ds/tokens.css';
// The design system (and its styles) before app.css, so the app can override its styles.
import './ds';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { App } from './App';
import { createPersister, queryClient } from './lib/queries';
import { APP_VERSION } from './lib/version';
import { loadConfig } from './lib/i18n';

registerSW({ immediate: true });

/**
 * Apps installed BEFORE the switch to the "black" status bar (iOS reads this setting at install time):
 * with "black-translucent", iOS 26 pins a web view shortened by the status bar height to the top,
 * and paints the bottom of the screen with the page background. We detect it by a non-zero top inset
 * (web view below the status bar) AND a web view shorter than the screen. In that case the home
 * indicator is outside the web view: no inset for it, and a page background matching the navigation.
 * With "black" (new install), the web view reaches the bottom: nothing changes.
 */
if ((navigator as any).standalone === true) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const check = () => {
    const underStatusBar = probe.getBoundingClientRect().height > 0;
    document.documentElement.classList.toggle('short-webview', underStatusBar && innerHeight < screen.height - 1);
  };
  check();
  addEventListener('resize', check);
}

// The cache kept on the phone is dropped on every new version (the data format may have changed).
const persister = createPersister();
// Instance name, language and scoring first: every text depends on them.
void loadConfig().then(() => createRoot(document.getElementById('root')!).render(
  persister ? (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 3600_000, buster: APP_VERSION }}>
      <App />
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
));
