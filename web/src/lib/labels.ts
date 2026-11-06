/** Small display helpers without React, shared by the screens (and tested). */
import type { EspnStatsDto, GameDto, StandingRow, TeamSheetDto, TeamStandingDto } from './api';
import { timeLabel } from './format';
import { t } from './i18n';

export type { EspnStatsDto };

/** "1er AFC Est · 3e tête de série" or "3e NFC Nord · hors playoffs". */
export function standingText(st: TeamStandingDto | null): string {
  if (!st) return '–';
  return t.team.standing(st.divRank, st.division, st.seed, st.clinch === 'out');
}

/** Label of the link to the match page, depending on the game state and whether picks count. */
export function detailLabel(status: GameDto['status'], counted: boolean): string {
  return t.matches.detailLink(status, counted);
}

type ScheduleGame = TeamSheetDto['schedule'][number];

/** Adds the week without a game (bye) to the regular season, between two played or scheduled games. */
export function withByes(schedule: ScheduleGame[]): (ScheduleGame | { bye: true; week: number })[] {
  const weeks = new Set(schedule.map((g) => g.week));
  const last = Math.max(0, ...schedule.filter((g) => g.week <= 18).map((g) => g.week));
  const out: (ScheduleGame | { bye: true; week: number })[] = [];
  for (let w = 1; w <= last; w++) if (!weeks.has(w)) out.push({ bye: true, week: w });
  return [...out, ...schedule].sort((a, b) => a.week - b.week);
}

/** "12 ESPN calls in the last hour · 140 over 24 h", or the pause if ESPN asked to slow down. */
export function espnLine(e: EspnStatsDto): string {
  return t.admin.espn(e.lastHour, e.lastDay, e.errorsLastHour, e.pausedUntil ? timeLabel(e.pausedUntil) : null);
}

type Row = Pick<StandingRow, 'good' | 'played' | 'startPoints' | 'bonus'>;

/**
 * Line under the name in the season leaderboard: "81 / 135", with carried-over points
 * only for those who have some (player who joined mid-season) and the bonus if any.
 */
export function seasonRecord(r: Row, startWeek: number): string {
  return t.leaderboard.seasonRecord(r, startWeek);
}

/** Season recap: where the points come from. */
export function pointsOrigin(r: Row & { points: number }): string {
  return t.season.pointsOrigin(r);
}
