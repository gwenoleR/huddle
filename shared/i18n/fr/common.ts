/** Words and formats shared by everyone: weeks, numbers, generic errors. */

/** « 1 prono », « 2 pronos ». For words with an irregular plural, pass the plural. */
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const PLAYOFF_WEEKS: Record<number, { short: string; long: string }> = {
  19: { short: 'Wild Card', long: 'Wild Card' },
  20: { short: 'Div.', long: 'Tour de division' },
  21: { short: 'Conf.', long: 'Finales de conférence' },
  22: { short: 'Super Bowl', long: 'Super Bowl' }
};

export const common = {
  /** Language of dates and numbers (Intl) and of the page (<html lang>). */
  locale: 'fr-FR',
  htmlLang: 'fr',

  /** App name if the instance doesn't set one (APP_NAME). */
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
  /** « 1re », « 2e » (seed, position) */
  ordinalFem: (n: number) => (n === 1 ? '1re' : `${n}e`),

  /** App weeks: 1 to 18 = regular season, then 19 Wild Card, 20 Div., 21 Conf., 22 Super Bowl. */
  weekLabel: (week: number, long = false) => {
    const w = PLAYOFF_WEEKS[week];
    if (w) return long ? w.long : w.short;
    return long ? `Semaine ${week}` : `S${week}`;
  },

  /** Scoring reminder at the top of the leaderboard: « 1 pt par bon prono, 2 en playoffs ». */
  scoring: (regular: number, playoffs: number) =>
    `${count(regular, 'pt', 'pts')} par bon prono${playoffs !== regular ? `, ${playoffs} en playoffs` : ''}`,

  errors: {
    network: 'Pas de réseau. Réessaie dans un instant.',
    server: 'Oups, le serveur fait des siennes.',
    unexpected: 'Erreur inattendue.'
  }
};
