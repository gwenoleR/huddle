/**
 * Réglages de l'instance (nom, langue, barème) et textes dans sa langue, pour toute l'appli.
 *
 * Lus au démarrage, avant le premier affichage (main.tsx) : depuis le téléphone s'ils y sont déjà
 * (démarrage instantané, et hors ligne), sinon depuis /api/config. Une version plus récente du
 * serveur est gardée pour le lancement suivant.
 *
 * `t` et `config` sont des liaisons vivantes : `import { t } from '../lib/i18n'` puis `t.leaderboard.title`.
 */
import { messages, type Messages } from '../../../shared/i18n';
import type { ConfigDto } from './api';

const KEY = 'prono-config';
const fr = messages('fr');

export const DEFAULT_CONFIG: ConfigDto = {
  appName: fr.common.appName,
  appShortName: fr.common.appShortName,
  lang: 'fr',
  points: { regular: 1, playoffs: 2 }
};

export let config: ConfigDto = DEFAULT_CONFIG;
export let t: Messages = fr;

export function applyConfig(c: ConfigDto) {
  config = c;
  t = messages(c.lang);
  if (typeof document !== 'undefined') {
    document.title = c.appName;
    document.documentElement.lang = t.common.htmlLang;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', c.appShortName);
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.common.appDescription);
  }
}

function readCached(): ConfigDto | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return c && typeof c.appName === 'string' && typeof c.lang === 'string' && c.points ? c : null;
  } catch {
    return null;
  }
}

/** Au démarrage : réglages gardés sur le téléphone, sinon ceux du serveur, sinon ceux par défaut. */
export async function loadConfig(fetchConfig = () => fetch('/api/config', { cache: 'no-store' })): Promise<void> {
  const fresh = fetchConfig()
    .then((r) => (r.ok ? (r.json() as Promise<ConfigDto>) : null))
    .then((c) => {
      if (c)
        try {
          localStorage.setItem(KEY, JSON.stringify(c));
        } catch {
          /* stockage plein ou interdit : tant pis, on relira le serveur */
        }
      return c;
    })
    .catch(() => null);
  const cached = readCached();
  if (cached) {
    applyConfig(cached);
    void fresh; // la version du serveur servira au prochain lancement
    return;
  }
  applyConfig((await fresh) ?? DEFAULT_CONFIG);
}
