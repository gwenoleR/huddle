/** Fiche d'une équipe et classement NFL. */
import { common } from './common';

export const team = {
  /** « 1er AFC Est · 3e tête de série », « 3e NFC Nord · hors playoffs (11e) », « 4e AFC Est · éliminé ». */
  standing: (divRank: number, division: string, seed: number | null, eliminated: boolean) => {
    const div = `${common.ordinal(divRank)} ${division}`;
    if (eliminated) return `${div} · éliminé`;
    if (!seed) return div;
    return seed <= 7 ? `${div} · ${common.ordinalFem(seed)} tête de série` : `${div} · hors playoffs (${seed}e)`;
  },

  /** Fiche équipe. */
  bandTitle: (team: string) => `La bande et les ${team}`,
  noBandPicks: 'Personne n’a encore eu de prono terminé sur un de leurs matchs.',
  withThem: (n: number) => `Avec eux ${n}×`,
  against: (n: number) => `Contre ${n}×`,
  good: (n: number) => `${n} bon${n > 1 ? 's' : ''}`,
  schedule: 'Calendrier',
  bye: 'Semaine de repos',
  /** Avant l'adversaire : à domicile « vs », à l'extérieur « @ ». */
  vs: 'vs',
  at: '@',
  live: (score: string | null) => (score ? `En direct ${score}` : 'En direct'),
  close: 'Fermer',

  /** Classement NFL. */
  nflEyebrow: (season: number | string) => `Saison ${season} · NFL`,
  nflTitle: 'Classement',
  race: 'Course aux playoffs',
  divisions: 'Divisions',
  playoffLine: 'Ligne des playoffs',
  divisionWinner: (division: string) => `${common.ordinal(1)} ${division}`,
  wildCard: 'Wild card',
  clinched: 'qualifié',
  eliminated: 'éliminé',
  raceHelp:
    'Par conférence, 7 équipes vont en playoffs : les 4 vainqueurs de division (têtes de série 1 à 4) et les 3 meilleures autres (wild cards). La tête de série 1 est exemptée du premier tour.',
  colRecord: 'Bilan',
  colStreak: 'Série',
  colDiff: 'Diff.',
  /** Sous le nom, vue divisions : « Tête de série 3 » si en playoffs, sinon « 11e AFC ». */
  seed: (seed: number | null, conference: string, inPlayoffs: boolean) =>
    inPlayoffs ? `Tête de série ${seed}` : `${seed ?? '–'}e ${conference}`,
  divisionsHelp: 'Série : victoires (V) ou défaites (D) d’affilée. Diff. : points marqués moins points encaissés.'
};
