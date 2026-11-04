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
 * Bug iOS (appli ajoutée à l'écran d'accueil, barre d'état translucide) : la hauteur de la fenêtre
 * ignore la zone de l'heure, ce qui laisse une bande vide sous la navigation. On prend alors la
 * hauteur réelle de l'écran. Si iOS corrige le bug, innerHeight vaut déjà screen.height : rien ne change.
 */
if ((navigator as any).standalone === true) {
  const fit = () => {
    const h = Math.max(innerHeight, screen.height);
    document.documentElement.style.setProperty('--app-h', `${h}px`);
  };
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
}

createRoot(document.getElementById('root')!).render(<App />);
