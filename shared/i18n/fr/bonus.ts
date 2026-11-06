/** Bonus de fin de saison (écran des joueurs). */
import { common } from './common';

export const bonus = {
  /** « Playoffs · jusqu’à 6 pts à gagner » */
  eyebrow: (max: number) => `Playoffs · jusqu’à ${common.points(max)} à gagner`,
  title: 'Bonus de fin de saison',
  off: 'Le bonus est désactivé pour cette saison.',

  /** « Champion AFC » ; `conf` est le sigle de la conférence. */
  champion: (conf: string) => `Champion ${conf}`,
  sbWinner: 'Vainqueur du Super Bowl',
  points: (n: number) => common.points(n),
  /** Règles : quand les choix sont révélés (au Super Bowl ou à la Wild Card), et le départage. */
  rules: (revealAtSuperBowl: boolean) =>
    `Les choix restent secrets jusqu’au ${revealAtSuperBowl ? 'coup d’envoi du Super Bowl' : 'premier match de Wild Card'}${
      revealAtSuperBowl ? ' (on peut les changer jusqu’à la Wild Card)' : ''
    }. En cas d’égalité au classement final, le plus proche du total de points marqués au Super Bowl passe devant.`,

  waitingTitle: 'Pas encore ouvert',
  waitingText: 'Les choix s’ouvrent à la fin de la saison régulière, dès que les 14 qualifiés sont connus. Tu recevras une notification.',

  /** « À choisir avant le dim. 11 janv. à 19:00 » */
  lockAt: (day: string, time: string) => `À choisir avant le ${day} à ${time}`,
  alreadySaved: ' · Tes choix sont enregistrés, tu peux encore les changer',
  /** « Tête de série 3 » */
  seed: (seed: number) => `Tête de série ${seed}`,
  pickChampionsFirst: 'Choisis d’abord tes deux champions.',
  totalLabel: 'Total de points au Super Bowl',
  totalHelp: 'Les deux équipes additionnées. Sert seulement à départager les égalités.',
  totalPlaceholder: 'ex. 47',
  submit: (update: boolean) => (update ? 'Mettre à jour mes choix' : 'Valider mes choix'),
  saved: 'Choix enregistrés. Secret jusqu’au coup d’envoi !',

  resultsTitle: 'Les résultats',
  superBowl: 'Super Bowl',
  pending: 'à venir',
  /** « Chiefs · 47 pts au total » */
  sbResult: (team: string, total: number | null) => `${team} · ${total} pts au total`,

  lockedTitle: 'Choix verrouillés 🔒',
  /** Avant la révélation ; `at` = jour et heure du coup d’envoi s’ils sont connus. */
  lockedText: (at: { day: string; time: string } | null) =>
    `Les choix de la bande seront révélés au coup d’envoi du Super Bowl${at ? `, le ${at.day} à ${at.time}` : ''}. Les points bonus arriveront au classement à ce moment-là.`,

  playersTitle: 'Les choix de la bande',
  you: 'Toi',
  noPick: 'Pas de choix fait à temps.',
  /** Ligne d’un choix : « AFC : Chiefs », « SB : Chiefs » */
  pickLine: (label: 'AFC' | 'NFC' | 'SB', team: string) => `${label} : ${team}`,
  /** Après le vainqueur choisi : « · 47 pts » */
  pickTotal: (total: number) => ` · ${total} pts`,
  /** Écart avec le vrai total : « (écart 5) » */
  pickGap: (gap: number) => ` (écart ${gap})`,

  chose: 'Ont choisi',
  notChosen: (locked: boolean) => (locked ? 'Pas de choix' : 'Pas encore'),
  nobody: 'Personne'
};
