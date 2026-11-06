/** Import de l'historique en CSV (messages du serveur). */
export const history = {
  emptyFile: 'Fichier vide : il faut une ligne d’en-têtes, puis une ligne par match.',
  unreadableWeek: (line: number, cell: string) => `Ligne ${line} : semaine illisible « ${cell} »`,
  gameBeforeFirstWeek: (line: number) => `Ligne ${line} : match avant la première semaine`,

  /** Le match concerné par un problème : « S9 KC @ BUF » (numéro de semaine brut du fichier). */
  where: (week: number, away: string, home: string) => `S${week} ${away} @ ${home}`,
  unknownTeam: (where: string) => `${where} : équipe inconnue`,
  gameNotFound: (where: string) => `${where} : match introuvable (synchro pas encore faite ?)`,
  duplicateGame: (where: string) => `${where} : match en double`,
  ambiguousPlayer: (initials: string, names: string[]) =>
    `joueur « ${initials} » ambigu : ${names.join(', ')} commencent par ces lettres`,
  unknownPlayer: (initials: string) => `joueur « ${initials} » inconnu : ajoute-le d’abord, ou corrige l’en-tête de sa colonne`,
  pickNotInGame: (where: string, initials: string, pick: string) => `${where} : prono de ${initials} « ${pick} » ne joue pas ce match`,

  /** Tous les problèmes, un par ligne. */
  notImported: (problems: string[]) => `Historique non importé :\n- ${problems.join('\n- ')}`
};
