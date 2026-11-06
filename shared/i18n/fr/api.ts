/** Error messages returned by the server. */
export const api = {
  // Login and permissions
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
  /** Forced sync that fails, with the reason given by the sync status. */
  syncFailed: (reason: string) => `Synchro impossible : ${reason}`,

  // Games and picks
  /** API address or logo that doesn't exist. */
  notFound: 'Introuvable',
  gameNotFound: 'Match introuvable.',
  invalidPick: 'Choix invalide.',
  gameStarted: 'Trop tard, le match a commencé.',
  gameNotStarted: 'Le match n’a pas commencé.',
  previewUnavailable: 'Infos d’avant-match indisponibles pour le moment.',
  liveUnavailable: 'Le direct ESPN ne répond pas pour le moment.',

  // Leaderboards
  unknownSeason: 'Saison inconnue.',
  noFinishedGame: 'Pas encore de match terminé.',
  nflStandingsUnavailable: 'Le classement NFL ne répond pas pour le moment.',
  teamNotFound: 'Équipe introuvable.',

  // End-of-season bonus
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
