/** Page Administration. */
import { common, count } from './common';

export const admin = {
  back: 'Profil',
  title: 'Administration',
  adminsOnly: 'Réservé aux admins du groupe.',
  seasonSection: 'Saison',
  dataSection: 'Données',

  /** Ligne d'état des appels ESPN ; `pausedUntil` déjà mis en forme (« 19:40 »). */
  espn: (lastHour: number, lastDay: number, errors: number, pausedUntil: string | null) => {
    if (pausedUntil) return `ESPN demande de ralentir : appels en pause jusqu’à ${pausedUntil}`;
    return `${count(lastHour, 'appel')} ESPN sur la dernière heure${errors ? ` · ${errors} en erreur` : ''} · ${lastDay} sur 24 h`;
  },

  // Synchro ESPN
  syncDone: (games: number) => `Synchro faite : ${games} matchs`,
  syncLabel: 'Données ESPN',
  /** « Dernière synchro mar. 19:40 · » ou « Échec mar. 19:40 · » ; `when` déjà mis en forme. */
  syncWhen: (ok: boolean, when: string) => `${ok ? 'Dernière synchro' : 'Échec'} ${when} · `,
  syncGames: (games: number) => `${games} matchs en base`,
  syncing: 'Synchro en cours… (≈ 15 s)',
  syncNow: 'Synchroniser maintenant',

  // Bonus de fin de saison
  bonusAfc: 'Champion AFC',
  bonusNfc: 'Champion NFC',
  bonusSb: 'Vainqueur du Super Bowl',
  bonusScaleSaved: 'Barème du bonus enregistré',
  bonusLabel: 'Bonus de fin de saison',
  bonusOnHelp: 'Activé : visible par tous, points comptés au classement.',
  bonusOffHelp: 'Désactivé : caché pour tout le monde, aucun point compté.',
  bonusDisabled: 'Bonus désactivé',
  bonusEnabled: 'Bonus activé',
  bonusDisable: 'Désactiver le bonus',
  bonusEnable: 'Activer le bonus',
  pointsUnit: 'pts',
  bonusSaveScale: 'Enregistrer le barème',
  revealLabel: 'Révéler les choix de la bande',
  revealWildcard: 'À la Wild Card',
  revealSuperbowl: 'Au Super Bowl',
  revealed: (at: 'wildcard' | 'superbowl') => `Choix révélés ${at === 'wildcard' ? 'à la Wild Card' : 'au Super Bowl'}`,
  revealWildcardHelp: 'Dès la clôture des choix : on suit qui est encore en course pendant les playoffs.',
  revealSuperbowlHelp: 'Au coup d’envoi du Super Bowl : suspense jusqu’au bout, points bonus ajoutés à ce moment-là.',

  // Joueurs
  added: (name: string) => `${name} ajouté`,
  confirmResetPin: (name: string) => `Effacer le code de ${name} ? Il en choisira un nouveau à sa prochaine connexion.`,
  pinReset: (name: string) => `Code de ${name} effacé`,
  renamePrompt: (name: string) => `Nouveau prénom pour ${name}`,
  renamed: (before: string, after: string) => `${before} s’appelle maintenant ${after}`,
  noLongerAdmin: (name: string) => `${name} n’est plus admin`,
  nowAdmin: (name: string) => `${name} est admin`,
  confirmRemove: (name: string) => `Supprimer ${name} ? Ses pronos et ses points disparaissent pour de bon.`,
  removed: (name: string) => `${name} supprimé`,
  playersSection: (n: number) => `Joueurs · ${n}`,
  tagAdmin: 'admin',
  tagNoPin: 'pas encore connecté',
  tagStartPoints: (points: number) => `${points} pts de départ`,
  rename: 'Renommer',
  resetPin: 'Effacer le code',
  removeAdmin: 'Retirer admin',
  makeAdmin: 'Nommer admin',
  remove: 'Supprimer',
  addPlayer: 'Ajouter un joueur',
  firstName: 'Prénom',
  startPoints: 'Points de départ (s’il arrive en cours de saison)',
  add: 'Ajouter',

  // Import de l'historique
  imported: (picks: number) => `${common.pronos(picks)} importés`,
  importLabel: 'Importer l’historique',
  importHelp:
    'Les semaines jouées ailleurs, en CSV : une ligne d’en-têtes (« , Home, Away, Prono GW, Prono AU… », deux lettres du prénom), puis une ligne par match (« Week1 » sur le premier match de chaque semaine). Les points de départ des joueurs du fichier repassent à 0.',
  chooseCsv: 'Choisir un fichier CSV',
  importPreview: (picks: number, games: number, players: string[]) => `${common.pronos(picks)} sur ${common.matches(games)}, pour ${players.join(', ')}.`,
  importNow: 'Importer'
};
