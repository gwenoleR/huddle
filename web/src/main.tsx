import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './ds/tokens.css';
import './ds/components.css';
import './app.css';
import { App } from './App';

registerSW({ immediate: true });

/**
 * iOS, appli ajoutée à l'écran d'accueil : la zone web s'arrête avant le bas de l'écran (elle est
 * plus courte que l'écran de la hauteur de la zone de l'heure) et iOS peint le reste avec le fond
 * de la page. La barre d'accueil est alors hors de la zone web : pas de marge à lui laisser, et le
 * fond de page prend la couleur de la navigation pour la prolonger jusqu'en bas.
 * Si iOS corrige ce comportement, innerHeight vaut screen.height et rien ne change.
 */
if ((navigator as any).standalone === true) {
  const check = () => document.documentElement.classList.toggle('short-webview', innerHeight < screen.height - 1);
  check();
  addEventListener('resize', check);
}

createRoot(document.getElementById('root')!).render(<App />);
