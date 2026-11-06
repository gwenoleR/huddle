/** Season recap and trophies (display). */
import { common } from './common';

export const season = {
  /** Where the points come from: « 81 bons pronos + 8 de bonus », « 40 repris + 5 dans l’appli ». */
  pointsOrigin: (r: { good: number; startPoints: number; bonus: number; points: number }) => {
    if (r.startPoints) return `${r.startPoints} repris + ${r.points - r.startPoints} dans l’appli`;
    return `${common.goodPicks(r.good)}${r.bonus ? ` + ${r.bonus} de bonus` : ''}`;
  },

  /** « Saison 2026 en cours · 120 matchs joués » */
  eyebrow: (season: number | string, finished: boolean, games: number) =>
    `Saison ${season} ${finished ? 'terminée' : 'en cours'} · ${games} matchs joués`,
  title: 'Bilan de saison',
  championTitle: (finished: boolean): string => (finished ? 'Titre de la saison' : 'En tête pour l’instant'),
  /** Unit after the champion's points (preceded by a space). */
  pointsUnit: ' pts',
  standingsTitle: (finished: boolean): string => (finished ? 'Classement final' : 'Classement actuel'),
  trophiesTitle: 'Les trophées de la bande',
  noTrophiesYet: 'Les trophées arrivent après les premiers matchs joués.',
  toWinTitle: (finished: boolean): string => (finished ? 'Pas attribués cette saison' : 'Encore à gagner'),
  previousSeasons: 'Saisons précédentes',
  otherSeasons: 'Autres saisons',

  /** Line under a trophy's title: « Gwen · 12 bons pronos d’affilée », or nobody. */
  awardLine: (who: string | null, detail: string | null, finished: boolean) =>
    who ? `${who} · ${detail}` : finished ? 'Personne' : 'Personne pour l’instant',

  /** A trophy's dialog */
  itsYou: 'C’est toi !',
  nobody: (finished: boolean): string => (finished ? 'Personne ne l’a décroché cette saison.' : 'Personne ne le mérite encore. La place est libre.'),
  howToWin: 'Comment on le gagne',
  ruleNote: 'Seuls les matchs terminés comptent. Le trophée peut changer de main à tout moment.',
  close: 'Compris'
};
