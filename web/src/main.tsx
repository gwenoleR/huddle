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

createRoot(document.getElementById('root')!).render(<App />);
