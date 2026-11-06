/** Messages d'erreur renvoyés par le serveur. */
export const api = {
  // Connexion et droits
  groupExists: 'Le groupe existe déjà : connecte-toi.',
  loginFirst: 'Connecte-toi d’abord',
  adminOnly: 'Réservé à l’admin',
  invalidName: 'Prénom invalide.',
  nameTaken: 'Ce prénom existe déjà.',
  invalidPin: 'Le code fait 4 chiffres.',
  unknownPlayer: 'Joueur inconnu.',
  tooManyTriesFromIp: 'Trop d’essais depuis cette connexion, réessaie dans une heure.',
  tooManyTries: (minutes: number) => `Trop d’essais. Réessaie dans ${minutes} min.`,
  wrongPin: (left: number) => `Code incorrect. Encore ${left} essai${left > 1 ? 's' : ''}.`,

  // Administration
  cannotRevokeOwnAdmin: 'Tu ne peux pas te retirer tes propres droits d’admin.',
  invalidStartPoints: 'Points de départ invalides.',
  cannotDeleteSelf: 'Tu ne peux pas te supprimer toi-même.',
  /** Synchro forcée qui échoue, avec la raison donnée par l'état de la synchro. */
  syncFailed: (reason: string) => `Synchro impossible : ${reason}`,

  // Matchs et pronos
  /** Adresse d'API ou logo qui n'existe pas. */
  notFound: 'Introuvable',
  gameNotFound: 'Match introuvable.',
  invalidPick: 'Choix invalide.',
  gameStarted: 'Trop tard, le match a commencé.',
  gameNotStarted: 'Le match n’a pas commencé.',
  previewUnavailable: 'Infos d’avant-match indisponibles pour le moment.',
  liveUnavailable: 'Le direct ESPN ne répond pas pour le moment.',

  // Classements
  unknownSeason: 'Saison inconnue.',
  noFinishedGame: 'Pas encore de match terminé.',
  nflStandingsUnavailable: 'Le classement NFL ne répond pas pour le moment.',
  teamNotFound: 'Équipe introuvable.',

  // Bonus de fin de saison
  bonusClosed: 'Les choix du bonus ne sont pas ouverts.',
  bonusPickAfc: 'Choisis un champion AFC parmi les qualifiés.',
  bonusPickNfc: 'Choisis un champion NFC parmi les qualifiés.',
  bonusPickSuperBowl: 'Le vainqueur du Super Bowl doit être un de tes deux champions.',
  bonusTiebreak: 'Donne un total de points entre 0 et 200.',
  bonusInvalidPoints: 'Les points doivent être des nombres entiers entre 0 et 50.',
  bonusUnknownReveal: 'Révélation inconnue.',

  // Notifications
  invalidSubscription: 'Abonnement invalide.'
};
