/**
 * Instance settings (name, language, scoring) and texts in its language, for the whole app.
 *
 * Read at startup, before the first render (main.tsx): from the phone if already stored there
 * (instant startup, and offline), otherwise from /api/config. A newer version from the
 * server is kept for the next launch.
 *
 * `t` and `config` are live bindings: `import { t } from '../lib/i18n'` then `t.leaderboard.title`.
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

/** At startup: settings kept on the phone, otherwise the server's, otherwise the defaults. */
export async function loadConfig(fetchConfig = () => fetch('/api/config', { cache: 'no-store' })): Promise<void> {
  const fresh = fetchConfig()
    .then((r) => (r.ok ? (r.json() as Promise<ConfigDto>) : null))
    .then((c) => {
      if (c)
        try {
          localStorage.setItem(KEY, JSON.stringify(c));
        } catch {
          /* storage full or forbidden: never mind, we'll read from the server again */
        }
      return c;
    })
    .catch(() => null);
  const cached = readCached();
  if (cached) {
    applyConfig(cached);
    void fresh; // the server version will be used on the next launch
    return;
  }
  applyConfig((await fresh) ?? DEFAULT_CONFIG);
}
