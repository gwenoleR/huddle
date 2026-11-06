/** ESPN sync status shown to the admin. */
import type { Messages } from '../index';
export const sync = {
  never: 'No sync yet',
  /** Successful full sync: "32 teams, 272 games". */
  done: (teams: number, games: number) => `${teams} teams, ${games} games`,
  /** A failed week: "W9: ESPN unreachable…" (raw week number). */
  weekFailed: (week: number, reason: string) => `W${week}: ${reason}`,

  // ESPN call errors, shown in the sync status.
  espnPaused: (minutes: number) => `ESPN paused for ${minutes} more min (too many calls)`,
  espnTimeout: 'timed out (15 s)',
  espnUnreachable: (cause: string, host: string) => `ESPN unreachable (${cause}): ${host}`,
  espnTooManyCalls: 'ESPN returned 429 (too many calls), pausing calls',
  espnHttpError: (status: number, url: string) => `ESPN returned ${status} for ${url}`
} satisfies Messages['sync'];
