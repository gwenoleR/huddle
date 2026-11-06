/** État de la synchro ESPN montré à l'admin. */
export const sync = {
  never: 'Pas encore de synchro',
  /** Synchro complète réussie : « 32 équipes, 272 matchs ». */
  done: (teams: number, games: number) => `${teams} équipes, ${games} matchs`,
  /** Une semaine en échec : « S9 : ESPN injoignable… » (numéro de semaine brut). */
  weekFailed: (week: number, reason: string) => `S${week} : ${reason}`,

  // Erreurs d'appel à ESPN, affichées dans l'état de la synchro.
  espnPaused: (minutes: number) => `ESPN en pause encore ${minutes} min (trop d’appels)`,
  espnTimeout: 'délai dépassé (15 s)',
  espnUnreachable: (cause: string, host: string) => `ESPN injoignable (${cause}) : ${host}`,
  espnTooManyCalls: 'ESPN a répondu 429 (trop d’appels), pause des appels',
  espnHttpError: (status: number, url: string) => `ESPN a répondu ${status} sur ${url}`
};
