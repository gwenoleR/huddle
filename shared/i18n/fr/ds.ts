/** Textes des composants du design system (navigation, statuts, carte de match). */

export const ds = {
  loading: 'Chargement…',

  /** Barre de navigation du bas. */
  navLabel: 'Navigation principale',
  nav: { matchs: 'Matchs', classement: 'Classement', profil: 'Profil' } as Record<string, string>,

  /** Pastille d'état d'un match (et verdict du prono une fois terminé). */
  status: {
    open: 'Ouvert',
    locked: 'Verrouillé',
    live: 'En direct',
    final: 'Terminé',
    win: 'Bon prono',
    loss: 'Raté'
  },

  weekPickerLabel: 'Semaine',

  /** Carte de match. */
  myPick: 'Ton prono',
  /** Bouton d'une équipe, pour un lecteur d'écran : « Bills, ton prono ». */
  sideLabel: (team: string, picked: boolean) => `${team}${picked ? ', ton prono' : ''}`,
  nobodyPicked: 'Personne n’a encore joué',
  /** Barre de répartition : « 2 pour Bills, 1 pour Chiefs ». */
  splitLabel: (awayCount: number, away: string, homeCount: number, home: string) =>
    `${awayCount} pour ${away}, ${homeCount} pour ${home}`,

  /** Ligne du classement. */
  you: 'toi',
  pointsUnit: 'pts',

  /** Libellé avant une liste de liens : « Saisons précédentes : ». */
  listLabel: (label: string) => `${label} :`
};
