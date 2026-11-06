/** ESPN sync status shown to the admin. */
export const sync = {
  never: 'Pas encore de synchro',
  /** Successful full sync: « 32 équipes, 272 matchs ». */
  done: (teams: number, games: number) => `${teams} équipes, ${games} matchs`,
  /** A failed week: « S9 : ESPN injoignable… » (raw week number). */
  weekFailed: (week: number, reason: string) => `S${week} : ${reason}`,

  // ESPN call errors, shown in the sync status.
  espnPaused: (minutes: number) => `ESPN en pause encore ${minutes} min (trop d’appels)`,
  espnTimeout: 'délai dépassé (15 s)',
  espnUnreachable: (cause: string, host: string) => `ESPN injoignable (${cause}) : ${host}`,
  espnTooManyCalls: 'ESPN a répondu 429 (trop d’appels), pause des appels',
  espnHttpError: (status: number, url: string) => `ESPN a répondu ${status} sur ${url}`
};
