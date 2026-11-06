/** Mots et formats partagés par tout le monde : semaines, nombres, erreurs génériques. */

/** « 1 prono », « 2 pronos ». Pour les mots au pluriel irrégulier, passer le pluriel. */
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const PLAYOFF_WEEKS: Record<number, { short: string; long: string }> = {
  19: { short: 'Wild Card', long: 'Wild Card' },
  20: { short: 'Div.', long: 'Tour de division' },
  21: { short: 'Conf.', long: 'Finales de conférence' },
  22: { short: 'Super Bowl', long: 'Super Bowl' }
};

export const common = {
  /** Langue des dates et des nombres (Intl) et de la page (<html lang>). */
  locale: 'fr-FR',
  htmlLang: 'fr',

  /** Nom de l'appli si l'instance n'en donne pas (APP_NAME). */
  appName: 'Prono NFL entre potes',
  appShortName: 'Prono',
  appDescription: 'Les pronos NFL de la bande',

  count,
  pronos: (n: number) => count(n, 'prono'),
  goodPicks: (n: number) => count(n, 'bon prono', 'bons pronos'),
  matches: (n: number) => count(n, 'match', 'matchs'),
  points: (n: number) => count(n, 'pt', 'pts'),
  /** « 1er », « 2e » */
  ordinal: (n: number) => (n === 1 ? '1er' : `${n}e`),
  /** « 1re », « 2e » (tête de série, place) */
  ordinalFem: (n: number) => (n === 1 ? '1re' : `${n}e`),

  /** Semaines de l'appli : 1 à 18 = saison régulière, puis 19 Wild Card, 20 Div., 21 Conf., 22 Super Bowl. */
  weekLabel: (week: number, long = false) => {
    const w = PLAYOFF_WEEKS[week];
    if (w) return long ? w.long : w.short;
    return long ? `Semaine ${week}` : `S${week}`;
  },

  /** Barème rappelé en tête du classement : « 1 pt par bon prono, 2 en playoffs ». */
  scoring: (regular: number, playoffs: number) =>
    `${count(regular, 'pt', 'pts')} par bon prono${playoffs !== regular ? `, ${playoffs} en playoffs` : ''}`,

  errors: {
    network: 'Pas de réseau. Réessaie dans un instant.',
    server: 'Oups, le serveur fait des siennes.',
    unexpected: 'Erreur inattendue.'
  }
};
