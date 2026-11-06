/** Profil du joueur et réglages. */
import { common } from './common';

export const profile = {
  /** Sous le nom : « 2e sur 8 · 81 pts · saison 2026 » ; `rank` déjà mis en forme. */
  subtitle: (rank: string, players: number, points: number, season: number | string) =>
    `${rank} sur ${players} · ${points} pts · saison ${season}`,
  goodPicksLabel: (startWeek: number) => (startWeek > 1 ? `bons pronos depuis la S${startWeek}` : 'bons pronos cette saison'),
  /** « 62 % » */
  percent: (pct: number) => `${pct} %`,
  successLabel: 'de réussite',
  streakLabel: 'bons d’affilée',

  byWeek: 'Semaine par semaine',
  /** Ligne des points repris : « S1–S8 » ou « Avant ». */
  carriedWeeks: (startWeek: number) => (startWeek > 1 ? `S1–S${startWeek - 1}` : 'Avant'),
  carriedFrom: 'Repris de l’ancien site',
  carriedPoints: (points: number) => `${points} pts`,
  byWeekHelp: (playoffs: number) => `En vert, les semaines à 70 % ou plus. En playoffs, un bon prono vaut ${common.points(playoffs)}.`,

  settings: 'Réglages',
  theme: 'Thème',
  themeDark: 'Nuit',
  themeLight: 'Jour',
  themeAuto: 'Auto',
  install: 'Mettre l’appli sur l’écran d’accueil',
  installIos: 'Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ».',
  installOther: 'Dans Chrome : menu ⋮, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».',

  admin: 'Administration',
  adminHelp: 'Joueurs, bonus, données ESPN, import de l’historique',
  logout: 'Se déconnecter',

  newVersion: 'Nouvelle version dispo : recharger',
  version: (version: string, server: string | null) => `Version ${version}${server ? ` · serveur ${server}` : ''}`,

  notifications: 'Notifications',
  pushError: 'Impossible d’activer les notifications.',
  pushOn: 'Activées : rappel 1 h avant un match sans prono, et résultats en fin de semaine.',
  pushOff: 'Un rappel 1 h avant un match sans prono, et les résultats en fin de semaine.',
  pushDenied: 'Bloquées dans les réglages du téléphone. Autorise-les pour ce site, puis reviens ici.',
  pushNeedsInstall: 'Sur iPhone, ajoute d’abord l’appli à l’écran d’accueil, puis ouvre-la depuis l’icône.',
  pushUnsupported: 'Ce navigateur ne gère pas les notifications.',
  pushEnable: 'Activer les notifications',
  pushTest: 'M’envoyer un test',
  pushTestSent: 'Notification envoyée',
  pushTestNoDevice: 'Aucun appareil abonné',
  pushDisable: 'Désactiver'
};
