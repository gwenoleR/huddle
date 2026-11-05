/** Petites fonctions d'affichage sans React, partagées par les écrans (et testées). */
import type { EspnStatsDto, GameDto, StandingRow, TeamSheetDto, TeamStandingDto } from './api';

export type { EspnStatsDto };

/** « 1er AFC Est · 3e tête de série » ou « 3e NFC Nord · hors playoffs ». */
export function standingText(st: TeamStandingDto | null): string {
  if (!st) return '–';
  const div = `${st.divRank === 1 ? '1er' : `${st.divRank}e`} ${st.division}`;
  if (st.clinch === 'out') return `${div} · éliminé`;
  if (!st.seed) return div;
  return st.seed <= 7 ? `${div} · ${st.seed === 1 ? '1re' : `${st.seed}e`} tête de série` : `${div} · hors playoffs (${st.seed}e)`;
}

/** Libellé du lien vers la fiche match, selon l'état du match et si les pronos comptent. */
export function detailLabel(status: GameDto['status'], counted: boolean): string {
  const pronos = counted ? ' et pronos' : '';
  if (status === 'final') return `Stats du match${pronos}`;
  if (status === 'live') return `Suivre le match${pronos}`;
  return counted ? 'Favori, forme, blessés et pronos' : 'Favori, forme et blessés';
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

const hourOnly = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });

/** « 12 appels ESPN sur la dernière heure · 140 sur 24 h », ou la pause si ESPN a demandé de ralentir. */
export function espnLine(e: EspnStatsDto): string {
  if (e.pausedUntil) return `ESPN demande de ralentir : appels en pause jusqu’à ${hourOnly.format(e.pausedUntil)}`;
  const errors = e.errorsLastHour ? ` · ${e.errorsLastHour} en erreur` : '';
  return `${e.lastHour} appel${e.lastHour > 1 ? 's' : ''} ESPN sur la dernière heure${errors} · ${e.lastDay} sur 24 h`;
}

type Row = Pick<StandingRow, 'good' | 'played' | 'startPoints' | 'bonus'>;

/**
 * Ligne sous le nom au classement de la saison : « 81 / 135 », avec les points repris
 * seulement pour qui en a (joueur arrivé en cours de saison) et le bonus s'il y en a.
 */
export function seasonRecord(r: Row, startWeek: number): string {
  const bonus = r.bonus ? ` · +${r.bonus} bonus` : '';
  if (!r.played) return r.startPoints ? `${r.startPoints} pts repris de l’ancien site${bonus}` : `Pas encore de match terminé${bonus}`;
  const since = startWeek > 1 ? ` depuis la S${startWeek}` : '';
  const kept = r.startPoints ? ` · ${r.startPoints} repris` : '';
  return `${r.good} / ${r.played}${since}${kept}${bonus}`;
}

/** Bilan de saison : d'où viennent les points. */
export function pointsOrigin(r: Row & { points: number }): string {
  if (r.startPoints) return `${r.startPoints} repris + ${r.points - r.startPoints} dans l’appli`;
  return `${r.good} bon${r.good > 1 ? 's' : ''} prono${r.good > 1 ? 's' : ''}${r.bonus ? ` + ${r.bonus} de bonus` : ''}`;
}
