// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICTIONARIES, messages } from '../../shared/i18n';

const fresh = async () => {
  vi.resetModules();
  return import('../../web/src/lib/i18n');
};
const ok = (body: object) => async () => new Response(JSON.stringify(body));
const CONFIG = { appName: 'Les Gros Pronos', appShortName: 'Gros', lang: 'fr', points: { regular: 1, playoffs: 3 } };

/** Stockage du téléphone, en mémoire (le localStorage expérimental de Node masque celui de jsdom). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  document.title = '';
});

describe('dictionnaires', () => {
  it('le français est la langue par défaut, et le secours d’une langue inconnue', () => {
    expect(Object.keys(DICTIONARIES)).toContain('fr');
    expect(messages('xx')).toBe(messages('fr'));
    expect(messages(undefined).common.locale).toBe('fr-FR');
  });

  it('quelques textes communs', () => {
    const t = messages('fr');
    expect([t.common.pronos(1), t.common.pronos(3), t.common.matches(2), t.common.points(1)]).toEqual(['1 prono', '3 pronos', '2 matchs', '1 pt']);
    expect([t.common.weekLabel(9), t.common.weekLabel(9, true), t.common.weekLabel(22)]).toEqual(['S9', 'Semaine 9', 'Super Bowl']);
    expect(t.common.scoring(1, 2)).toBe('1 pt par bon prono, 2 en playoffs');
    expect(t.common.scoring(2, 2)).toBe('2 pts par bon prono');
  });
});

describe('réglages au démarrage de l’appli', () => {
  it('premier lancement : ceux du serveur, gardés pour la suite', async () => {
    const i18n = await fresh();
    await i18n.loadConfig(ok(CONFIG));
    expect(i18n.config).toEqual(CONFIG);
    expect(document.title).toBe('Les Gros Pronos');
    expect(document.documentElement.lang).toBe('fr');
    expect(JSON.parse(localStorage.getItem('prono-config')!)).toEqual(CONFIG);
  });

  it('lancements suivants : tout de suite ceux du téléphone, ceux du serveur pour la fois d’après', async () => {
    localStorage.setItem('prono-config', JSON.stringify({ ...CONFIG, appName: 'Ancien nom' }));
    const i18n = await fresh();
    await i18n.loadConfig(ok(CONFIG));
    expect(i18n.config.appName).toBe('Ancien nom');
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem('prono-config')!).appName).toBe('Les Gros Pronos'));
  });

  it('serveur injoignable et rien sur le téléphone : réglages par défaut', async () => {
    const i18n = await fresh();
    await i18n.loadConfig(async () => {
      throw new Error('hors ligne');
    });
    expect(i18n.config).toEqual(i18n.DEFAULT_CONFIG);
    expect(i18n.t.common.appName).toBe('Prono NFL entre potes');
  });

  it('réglages abîmés sur le téléphone : ignorés', async () => {
    localStorage.setItem('prono-config', '{"appName":42');
    const i18n = await fresh();
    await i18n.loadConfig(ok(CONFIG));
    expect(i18n.config.appName).toBe('Les Gros Pronos');
  });
});
