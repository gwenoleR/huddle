import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type GameDto } from '../../web/src/lib/api';
import { CACHE_KEY, applyPick, claimCache, forgetEverything, keys, queryClient, shouldRetry, weekRefreshInterval } from '../../web/src/lib/queries';

const NOW = Date.parse('2026-11-08T18:00:00Z');
const MIN = 60_000;

/** Un localStorage minimal, comme celui du téléphone. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear()
  };
}
beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe('nouvel essai après une erreur', () => {
  it('réessaie deux fois après une coupure réseau ou une erreur serveur', () => {
    expect(shouldRetry(0, new ApiError(0, 'Pas de réseau'))).toBe(true);
    expect(shouldRetry(1, new ApiError(502, 'ESPN'))).toBe(true);
    expect(shouldRetry(2, new ApiError(502, 'ESPN'))).toBe(false);
  });

  it('ne réessaie jamais un refus (session expirée, match introuvable…)', () => {
    for (const status of [401, 403, 404, 409]) expect(shouldRetry(0, new ApiError(status, 'non'))).toBe(false);
  });
});

describe('rythme de rafraîchissement des matchs', () => {
  const g = (status: 'scheduled' | 'live' | 'final', kickoff: number) => ({ status, kickoff });

  it('30 s dès qu’un match est en cours', () => {
    expect(weekRefreshInterval([g('final', NOW - 5 * 60 * MIN), g('live', NOW - 60 * MIN)], NOW)).toBe(30_000);
  });

  it('30 s dans le quart d’heure avant un coup d’envoi (et tant que la synchro ne l’a pas vu commencer)', () => {
    expect(weekRefreshInterval([g('scheduled', NOW + 10 * MIN)], NOW)).toBe(30_000);
    expect(weekRefreshInterval([g('scheduled', NOW - 5 * MIN)], NOW)).toBe(30_000);
  });

  it('5 min sinon', () => {
    expect(weekRefreshInterval([g('scheduled', NOW + 3 * 60 * MIN), g('final', NOW - 60 * MIN)], NOW)).toBe(5 * MIN);
    expect(weekRefreshInterval([], NOW)).toBe(5 * MIN);
    expect(weekRefreshInterval(undefined, NOW)).toBe(5 * MIN);
  });
});

describe('prono affiché tout de suite', () => {
  const game: Pick<GameDto, 'myPick' | 'pickers'> = { myPick: null, pickers: { away: ['Audrey'], home: ['Gwen', 'Bea'] } };

  it('ajoute mon prénom en tête du bon côté', () => {
    expect(applyPick(game, 'away', 'Bea')).toEqual({ myPick: 'away', pickers: { away: ['Bea', 'Audrey'], home: ['Gwen'] } });
  });

  it('ne touche pas au match d’origine (pour pouvoir revenir en arrière)', () => {
    applyPick(game, 'home', 'Max');
    expect(game.pickers.home).toEqual(['Gwen', 'Bea']);
  });

  it('garde les autres champs du match', () => {
    const detail = { ...game, id: 'g1', waiting: ['Bud'] };
    expect(applyPick(detail, 'home', 'Bud')).toMatchObject({ id: 'g1', waiting: ['Bud'], myPick: 'home' });
  });
});

describe('clés du cache', () => {
  it('une clé par donnée, insensible à la casse pour les équipes', () => {
    expect(keys.team('buf')).toEqual(keys.team('BUF'));
    expect(keys.leaderboard()).toEqual(['leaderboard', 'season']);
    expect(keys.leaderboard(10)).toEqual(['leaderboard', 10]);
    expect(keys.recap()).not.toEqual(keys.recap(10));
  });
});

describe('cache gardé sur le téléphone', () => {
  it('la déconnexion efface tout', () => {
    queryClient.setQueryData(keys.profile, { name: 'Bea' });
    localStorage.setItem(CACHE_KEY, '{"cache":"de Bea"}');
    forgetEverything();
    expect(queryClient.getQueryData(keys.profile)).toBeUndefined();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('si un autre joueur se connecte sur le téléphone, on repart de zéro', () => {
    claimCache(3);
    queryClient.setQueryData(keys.profile, { name: 'Bea' });
    claimCache(3); // même joueur : on garde
    expect(queryClient.getQueryData(keys.profile)).toEqual({ name: 'Bea' });
    claimCache(5); // quelqu'un d'autre
    expect(queryClient.getQueryData(keys.profile)).toBeUndefined();
  });

  it('sans stockage (navigation privée), rien ne plante', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué');
      }
    });
    expect(() => claimCache(1)).not.toThrow();
    expect(() => forgetEverything()).not.toThrow();
  });
});
