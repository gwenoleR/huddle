import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type GameDto } from '../../web/src/lib/api';
import { CACHE_KEY, applyPick, claimCache, forgetEverything, keys, queryClient, shouldRetry, weekRefreshInterval } from '../../web/src/lib/queries';

const NOW = Date.parse('2026-11-08T18:00:00Z');
const MIN = 60_000;

/** A minimal localStorage, like the phone's. */
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

describe('retry after an error', () => {
  it('retries twice after a network outage or a server error', () => {
    expect(shouldRetry(0, new ApiError(0, 'No network'))).toBe(true);
    expect(shouldRetry(1, new ApiError(502, 'ESPN'))).toBe(true);
    expect(shouldRetry(2, new ApiError(502, 'ESPN'))).toBe(false);
  });

  it('never retries a rejection (expired session, game not found…)', () => {
    for (const status of [401, 403, 404, 409]) expect(shouldRetry(0, new ApiError(status, 'no'))).toBe(false);
  });
});

describe('game refresh pace', () => {
  const g = (status: 'scheduled' | 'live' | 'final', kickoff: number) => ({ status, kickoff });

  it('30 s as soon as a game is live', () => {
    expect(weekRefreshInterval([g('final', NOW - 5 * 60 * MIN), g('live', NOW - 60 * MIN)], NOW)).toBe(30_000);
  });

  it('30 s in the quarter hour before kickoff (and until the sync has seen it start)', () => {
    expect(weekRefreshInterval([g('scheduled', NOW + 10 * MIN)], NOW)).toBe(30_000);
    expect(weekRefreshInterval([g('scheduled', NOW - 5 * MIN)], NOW)).toBe(30_000);
  });

  it('5 min otherwise', () => {
    expect(weekRefreshInterval([g('scheduled', NOW + 3 * 60 * MIN), g('final', NOW - 60 * MIN)], NOW)).toBe(5 * MIN);
    expect(weekRefreshInterval([], NOW)).toBe(5 * MIN);
    expect(weekRefreshInterval(undefined, NOW)).toBe(5 * MIN);
  });
});

describe('pick shown right away', () => {
  const game: Pick<GameDto, 'myPick' | 'pickers'> = { myPick: null, pickers: { away: ['Audrey'], home: ['Gwen', 'Bea'] } };

  it('adds my name first on the right side', () => {
    expect(applyPick(game, 'away', 'Bea')).toEqual({ myPick: 'away', pickers: { away: ['Bea', 'Audrey'], home: ['Gwen'] } });
  });

  it('does not touch the original game (so it can be rolled back)', () => {
    applyPick(game, 'home', 'Max');
    expect(game.pickers.home).toEqual(['Gwen', 'Bea']);
  });

  it('keeps the game\'s other fields', () => {
    const detail = { ...game, id: 'g1', waiting: ['Bud'] };
    expect(applyPick(detail, 'home', 'Bud')).toMatchObject({ id: 'g1', waiting: ['Bud'], myPick: 'home' });
  });
});

describe('cache keys', () => {
  it('one key per data item, case-insensitive for teams', () => {
    expect(keys.team('buf')).toEqual(keys.team('BUF'));
    expect(keys.leaderboard()).toEqual(['leaderboard', 'season', 'current']);
    expect(keys.leaderboard(10)).toEqual(['leaderboard', 10, 'current']);
    expect(keys.leaderboard(undefined, 2025)).toEqual(['leaderboard', 'season', 2025]);
    expect(keys.seasonOf(2025).slice(0, 1)).toEqual(keys.season); // "reload everything" also covers past season summaries
    expect(keys.recap()).not.toEqual(keys.recap(10));
  });
});

describe('cache kept on the phone', () => {
  it('logout clears everything', () => {
    queryClient.setQueryData(keys.profile, { name: 'Bea' });
    localStorage.setItem(CACHE_KEY, '{"cache":"from Bea"}');
    forgetEverything();
    expect(queryClient.getQueryData(keys.profile)).toBeUndefined();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('if another player logs in on the phone, starts from scratch', () => {
    claimCache(3);
    queryClient.setQueryData(keys.profile, { name: 'Bea' });
    claimCache(3); // same player: kept
    expect(queryClient.getQueryData(keys.profile)).toEqual({ name: 'Bea' });
    claimCache(5); // someone else
    expect(queryClient.getQueryData(keys.profile)).toBeUndefined();
  });

  it('without storage (private browsing), nothing crashes', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      }
    });
    expect(() => claimCache(1)).not.toThrow();
    expect(() => forgetEverything()).not.toThrow();
  });
});
