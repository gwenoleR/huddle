/** Texts of the design system components (navigation, statuses, game card). */

export const ds = {
  loading: 'Chargement…',

  /** Bottom navigation bar. */
  navLabel: 'Navigation principale',
  nav: { matches: 'Matchs', standings: 'Classement', profile: 'Profil' },

  /** A game's status pill (and the pick's verdict once final). */
  status: {
    open: 'Ouvert',
    locked: 'Verrouillé',
    live: 'En direct',
    final: 'Terminé',
    win: 'Bon prono',
    loss: 'Raté'
  },

  weekPickerLabel: 'Semaine',

  /** Game card. */
  myPick: 'Ton prono',
  /** A team's button, for screen readers: « Bills, ton prono ». */
  sideLabel: (team: string, picked: boolean) => `${team}${picked ? ', ton prono' : ''}`,
  nobodyPicked: 'Personne n’a encore joué',
  /** Split bar: « 2 pour Bills, 1 pour Chiefs ». */
  splitLabel: (awayCount: number, away: string, homeCount: number, home: string) =>
    `${awayCount} pour ${away}, ${homeCount} pour ${home}`,

  /** Leaderboard row. */
  you: 'toi',
  pointsUnit: 'pts',

  /** Label before a list of links: « Saisons précédentes : ». */
  listLabel: (label: string) => `${label} :`
};
