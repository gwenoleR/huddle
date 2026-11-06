/**
 * Phone-side data cache (TanStack Query).
 *
 * - A screen already seen shows right away with the last version, then updates silently.
 * - Two components asking for the same thing make a single request.
 * - Automatic refreshes stop while the app is in the background, and everything is refreshed
 *   when coming back to the app.
 * - The cache is kept on the phone (localStorage): on open, the app shows the state from the
 *   last visit while the new one arrives.
 */
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ApiError, type GameDto } from './api';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Cache keys: one per piece of server data. */
export const keys = {
  weeks: ['weeks'] as const,
  week: (week: number) => ['week', week] as const,
  game: (id: string) => ['game', id] as const,
  preview: (id: string) => ['preview', id] as const,
  live: (id: string) => ['live', id] as const,
  /** Current season when no season is given; a past season is viewed as a whole (no week). */
  leaderboard: (week?: number, season?: number) => ['leaderboard', week ?? 'season', season ?? 'current'] as const,
  bonus: ['bonus'] as const,
  profile: ['profile'] as const,
  /** Prefix of all recaps (to reload them all); seasonOf for a specific recap. */
  season: ['season'] as const,
  seasonOf: (season?: number) => ['season', season ?? 'current'] as const,
  recap: (week?: number) => ['recap', week ?? 'last'] as const,
  nflStandings: ['nfl-standings'] as const,
  team: (abbr: string) => ['team', abbr.toUpperCase()] as const
};

/** Retry after a network failure or a server error, never after a refusal (4xx). */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failures < 2;
}

/** A week's games refresh every 30 s during games, otherwise every 5 min. */
export function weekRefreshInterval(games: Pick<GameDto, 'status' | 'kickoff'>[] | undefined, now = Date.now()): number {
  const hot = games?.some(
    (g) => g.status === 'live' || (g.status === 'scheduled' && g.kickoff - now < 15 * MIN && g.kickoff > now - 6 * HOUR)
  );
  return hot ? 30_000 : 5 * MIN;
}

/** Applies my pick right away, without waiting for the server (rolled back if it refuses). */
export function applyPick<G extends Pick<GameDto, 'myPick' | 'pickers'>>(g: G, side: 'away' | 'home', me: string): G {
  const away = g.pickers.away.filter((n) => n !== me);
  const home = g.pickers.home.filter((n) => n !== me);
  (side === 'away' ? away : home).unshift(me);
  return { ...g, myPick: side, pickers: { away, home } };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 s: switching screens and back doesn't refetch anything.
      staleTime: 30_000,
      // Kept 24 h, to show right away on the next open.
      gcTime: 24 * HOUR,
      retry: shouldRetry,
      refetchOnWindowFocus: true
    }
  }
});

export const CACHE_KEY = 'prono-cache';

/** Cache persistence on the phone (null if storage isn't available). */
export function createPersister() {
  try {
    const storage = window.localStorage;
    storage.getItem(CACHE_KEY);
    return createSyncStoragePersister({ storage, key: CACHE_KEY, throttleTime: 2000 });
  } catch {
    return null;
  }
}

/** On logout: forget everything, so the next player doesn't see the previous one's data. */
export function forgetEverything() {
  queryClient.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* no storage: nothing to erase */
  }
}

const OWNER_KEY = 'prono-cache-owner';

/** The cache belongs to one player: if someone else logs in on this phone, start from scratch. */
export function claimCache(playerId: number) {
  try {
    if (localStorage.getItem(OWNER_KEY) !== String(playerId)) {
      forgetEverything();
      localStorage.setItem(OWNER_KEY, String(playerId));
    }
  } catch {
    /* no storage: the cache doesn't survive closing anyway */
  }
}
