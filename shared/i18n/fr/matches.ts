/** The week's games list: Matches screen, game card, week picker, statuses. */
import { common } from './common';

export const matches = {
  /** Link to the match screen, depending on the game's state and whether picks count. */
  detailLink: (status: 'scheduled' | 'live' | 'final' | 'postponed', counted: boolean) => {
    const pronos = counted ? ' et pronos' : '';
    if (status === 'final') return `Stats du match${pronos}`;
    if (status === 'live') return `Suivre le match${pronos}`;
    return counted ? 'Favori, forme, blessés et pronos' : 'Favori, forme et blessés';
  },

  /** « Saison 2026 · Saison régulière » */
  eyebrow: (season: number, playoffs: boolean) => `Saison ${season} · ${playoffs ? 'Playoffs' : 'Saison régulière'}`,
  /** « 3 / 14 pronos » counter: the word after the numbers. */
  counterUnit: 'pronos',
  playoffPoints: (points: number) => `${common.points(points)} par bon prono`,
  /** « Il t’en reste 3 · prochain coup d’envoi dim. 19:00 » */
  remaining: (n: number, kickoff: string) => `Il t’en reste ${n} · prochain coup d’envoi ${kickoff}`,
  notCountedYet: (startWeek: number) => `Les pronos comptent à partir de la semaine ${startWeek}. Ici, juste les scores.`,
  noGames: 'Pas encore de match annoncé pour cette semaine.',
  /** Empty split for a game from before picks started counting. */
  beforeApp: 'Avant l’appli',
  allDone: 'Tous tes pronos sont faits. Plus qu’à attendre !',
  /** Times are the phone's: no time zone to specify. */
  footer: (games: number) => `${common.matches(games)} cette semaine`,

  /** Status on the card. */
  live: (detail: string) => `En direct · ${detail}`,
  postponed: 'Reporté',
  openPoints: (points: number) => `Ouvert · ${common.points(points)}`,

  /** End-of-season bonus card. */
  bonusTitle: 'Bonus de fin de saison',
  bonusMine: (lockDay: string) => `Tes choix sont faits · modifiables jusqu’au ${lockDay}`,
  bonusOpen: (max: number, lockDay: string) => `Jusqu’à ${max} pts à gagner · à choisir avant le ${lockDay}`,
  bonusRevealed: 'Les choix de la bande sont révélés',
  bonusLocked: 'Choix verrouillés · révélés au coup d’envoi du Super Bowl'
};
