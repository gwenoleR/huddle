/** Match screen: before (favorite, form, injuries), during and after (stats). */

const RESULT = { W: 'Victoire', L: 'Défaite', T: 'Nul' } as const;

export const match = {
  /** My name in the group's lists. */
  you: 'Toi',
  nobody: 'Personne',
  notPlayedYet: 'Pas encore joué',
  everyonePicked: 'Personne. Toute la bande a choisi son camp.',

  /** « 63 % » */
  percent: (n: number | string) => `${n} %`,
  /** Result letter (V, D, N) in the form and the schedule. */
  resultLetter: { W: 'V', L: 'D', T: 'N' } as Record<'W' | 'L' | 'T', string>,

  /** During and after the game. */
  /** Quarter: « Q1 »… then « Prol. ». */
  period: (p: number) => (p > 4 ? 'Prol.' : `Q${p}`),
  /** « Les <b>Bills</b> ont la balle »: sentence pieces, the (highlighted) team in the middle. */
  hasBall: <T>(team: T): readonly [string, T, string] => ['Les ', team, ' ont la balle'],
  redZone: 'Zone rouge',
  lastPlay: (text: string, abbr: string | null) => `Dernière action : ${text}${abbr ? ` (${abbr})` : ''}`,
  winChances: 'Chances de victoire',
  gameStory: 'Le scénario du match',
  byEspn: 'selon ESPN',
  myPickChances: (pct: number) => `Ton prono : ${pct} % de chances`,
  chartLabel: (away: string, home: string) => `Chances de victoire au fil du match : ${away} en haut, ${home} en bas`,
  statsTitle: 'Les stats du match',
  leadersTitle: 'Les meilleurs joueurs',
  scoringTitle: 'Les points marqués',

  /** Before the game. */
  favoriteTitle: 'Le favori',
  /** « Les <b>Bills</b>, avec environ 3,5 pts d’avance attendus »: pieces, the team in the middle. */
  favorite: <T>(team: T, spread: string | null): readonly [string, T, string] => [
    'Les ',
    team,
    spread ? `, avec environ ${spread} pts d’avance attendus` : ''
  ],
  tossUp: 'Pile ou face pour les bookmakers',
  winChancesEspn: 'Chances de victoire (ESPN)',
  chancesLabel: (away: string, awayPct: number, home: string, homePct: number) => `${away} ${awayPct} %, ${home} ${homePct} %`,
  recordTitle: 'Bilan et forme',
  colRecord: 'Bilan',
  colVenue: 'Dom. / ext.',
  atHome: 'à dom.',
  onTheRoad: 'à l’ext.',
  seeNflStandings: 'Voir le classement NFL',
  recordHelp: 'Bilan en victoires-défaites. Forme du plus ancien au plus récent.',
  /** Tooltip of a game in the form: « Victoire contre KC 24-17 », « Défaite chez BUF 10-31 ». */
  formGame: (result: 'W' | 'L' | 'T', home: boolean, opponent: string, score: string) =>
    `${RESULT[result]} ${home ? 'contre' : 'chez'} ${opponent} ${score}`,
  injuriesTitle: 'Infirmerie',
  injuriesHelp: 'Les forfaits officiels tombent en général la veille ou l’avant-veille du match.',
  noInjuries: 'Aucun blessé signalé pour ce match.',
  injuryStatus: { out: 'Forfait', doubtful: 'Douteux', questionable: 'Incertain' },
  injuredReserve: (n: number) => `+ ${n} en liste des blessés (absent${n > 1 ? 's' : ''} depuis plusieurs semaines)`
};
