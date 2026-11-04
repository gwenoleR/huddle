/** Petites fonctions d'affichage sans React, partagées par les écrans (et testées). */
import type { GameDto, TeamSheetDto, TeamStandingDto } from './api';

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
