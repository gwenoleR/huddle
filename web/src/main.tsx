import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './ds/tokens.css';
// Le design system (et ses styles) avant app.css : l'appli peut surcharger ses styles.
import './ds';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { App } from './App';
import { createPersister, queryClient } from './lib/queries';
import { APP_VERSION } from './lib/version';

registerSW({ immediate: true });

/**
 * Applis installées AVANT le passage à la barre d'état « black » (iOS lit ce réglage à l'installation) :
 * avec « black-translucent », iOS 26 colle en haut une zone web raccourcie de la hauteur de la barre
 * d'état, et peint le bas de l'écran avec le fond de la page. On le reconnaît à une marge du haut non
 * nulle (zone web sous la barre d'état) ET une zone web plus courte que l'écran. Dans ce cas la barre
 * d'accueil est hors de la zone web : pas de marge pour elle, et fond de page couleur navigation.
 * Avec « black » (nouvelle installation), la zone web va jusqu'en bas : rien ne change.
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

// Le cache gardé sur le téléphone est jeté à chaque nouvelle version (le format des données a pu changer).
const persister = createPersister();
createRoot(document.getElementById('root')!).render(
  persister ? (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 3600_000, buster: APP_VERSION }}>
      <App />
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
);
