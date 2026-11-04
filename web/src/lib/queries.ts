/**
 * Cache des données côté téléphone (TanStack Query).
 *
 * - Un écran déjà vu s'affiche tout de suite avec la dernière version, puis se met à jour en silence.
 * - Deux composants qui demandent la même chose ne font qu'une requête.
 * - Les rafraîchissements automatiques s'arrêtent quand l'appli est en arrière-plan, et tout est
 *   rafraîchi au retour dans l'appli.
 * - Le cache est gardé sur le téléphone (localStorage) : à l'ouverture, l'appli affiche l'état
 *   de la dernière visite le temps de recevoir le nouveau.
 */
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ApiError, type GameDto } from './api';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Clés du cache : une par donnée du serveur. */
export const keys = {
  weeks: ['weeks'] as const,
  week: (week: number) => ['week', week] as const,
  game: (id: string) => ['game', id] as const,
  preview: (id: string) => ['preview', id] as const,
  live: (id: string) => ['live', id] as const,
  leaderboard: (week?: number) => ['leaderboard', week ?? 'season'] as const,
  bonus: ['bonus'] as const,
  profile: ['profile'] as const,
  season: ['season'] as const,
  recap: (week?: number) => ['recap', week ?? 'last'] as const,
  nflStandings: ['nfl-standings'] as const,
  team: (abbr: string) => ['team', abbr.toUpperCase()] as const
};

/** On réessaie après une coupure réseau ou une erreur serveur, jamais après un refus (4xx). */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failures < 2;
}

/** Les matchs d'une semaine se rafraîchissent toutes les 30 s pendant les matchs, sinon toutes les 5 min. */
export function weekRefreshInterval(games: Pick<GameDto, 'status' | 'kickoff'>[] | undefined, now = Date.now()): number {
  const hot = games?.some(
    (g) => g.status === 'live' || (g.status === 'scheduled' && g.kickoff - now < 15 * MIN && g.kickoff > now - 6 * HOUR)
  );
  return hot ? 30_000 : 5 * MIN;
}

/** Applique mon prono tout de suite, sans attendre le serveur (on revient en arrière s'il refuse). */
export function applyPick<G extends Pick<GameDto, 'myPick' | 'pickers'>>(g: G, side: 'away' | 'home', me: string): G {
  const away = g.pickers.away.filter((n) => n !== me);
  const home = g.pickers.home.filter((n) => n !== me);
  (side === 'away' ? away : home).unshift(me);
  return { ...g, myPick: side, pickers: { away, home } };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Pendant 30 s une donnée est considérée à jour : changer d'écran et revenir ne relance rien.
      staleTime: 30_000,
      // Gardée 24 h, pour s'afficher tout de suite à la prochaine ouverture.
      gcTime: 24 * HOUR,
      retry: shouldRetry,
      refetchOnWindowFocus: true
    }
  }
});

export const CACHE_KEY = 'prono-cache';

/** Sauvegarde du cache sur le téléphone (null si le stockage n'est pas disponible). */
export function createPersister() {
  try {
    const storage = window.localStorage;
    storage.getItem(CACHE_KEY);
    return createSyncStoragePersister({ storage, key: CACHE_KEY, throttleTime: 2000 });
  } catch {
    return null;
  }
}

/** À la déconnexion : on oublie tout, pour que le joueur suivant ne voie pas les données du précédent. */
export function forgetEverything() {
  queryClient.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* pas de stockage : rien à effacer */
  }
}

const OWNER_KEY = 'prono-cache-owner';

/** Le cache appartient à un joueur : si quelqu'un d'autre se connecte sur ce téléphone, on repart de zéro. */
export function claimCache(playerId: number) {
  try {
    if (localStorage.getItem(OWNER_KEY) !== String(playerId)) {
      forgetEverything();
      localStorage.setItem(OWNER_KEY, String(playerId));
    }
  } catch {
    /* pas de stockage : le cache ne survit de toute façon pas à la fermeture */
  }
}
