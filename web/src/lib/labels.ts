/** Petites fonctions d'affichage sans React, partagées par les écrans (et testées). */
import type { EspnStatsDto, GameDto, StandingRow, TeamSheetDto, TeamStandingDto } from './api';
import { timeLabel } from './format';
import { t } from './i18n';

export type { EspnStatsDto };

/** « 1er AFC Est · 3e tête de série » ou « 3e NFC Nord · hors playoffs ». */
export function standingText(st: TeamStandingDto | null): string {
  if (!st) return '–';
  return t.team.standing(st.divRank, st.division, st.seed, st.clinch === 'out');
}

/** Libellé du lien vers la fiche match, selon l'état du match et si les pronos comptent. */
export function detailLabel(status: GameDto['status'], counted: boolean): string {
  return t.matches.detailLink(status, counted);
}

type ScheduleGame = TeamSheetDto['schedule'][number];

/** Ajoute la semaine sans match (bye) dans la saison régulière, entre deux matchs joués ou prévus. */
export function withByes(schedule: ScheduleGame[]): (ScheduleGame | { bye: true; week: number })[] {
  const weeks = new Set(schedule.map((g) => g.week));
  const last = Math.max(0, ...schedule.filter((g) => g.week <= 18).map((g) => g.week));
  const out: (ScheduleGame | { bye: true; week: number })[] = [];
  for (let w = 1; w <= last; w++) if (!weeks.has(w)) out.push({ bye: true, week: w });
  return [...out, ...schedule].sort((a, b) => a.week - b.week);
}

/** « 12 appels ESPN sur la dernière heure · 140 sur 24 h », ou la pause si ESPN a demandé de ralentir. */
export function espnLine(e: EspnStatsDto): string {
  return t.admin.espn(e.lastHour, e.lastDay, e.errorsLastHour, e.pausedUntil ? timeLabel(e.pausedUntil) : null);
}

type Row = Pick<StandingRow, 'good' | 'played' | 'startPoints' | 'bonus'>;

/**
 * Ligne sous le nom au classement de la saison : « 81 / 135 », avec les points repris
 * seulement pour qui en a (joueur arrivé en cours de saison) et le bonus s'il y en a.
 */
export function seasonRecord(r: Row, startWeek: number): string {
  return t.leaderboard.seasonRecord(r, startWeek);
}

/** Bilan de saison : d'où viennent les points. */
export function pointsOrigin(r: Row & { points: number }): string {
  return t.season.pointsOrigin(r);
}
