/** Fiche d'un match : avant (favori, forme, blessés), pendant et après (stats). */

const RESULT = { V: 'Victoire', D: 'Défaite', N: 'Nul' } as const;

export const match = {
  /** Mon nom dans les listes de la bande. */
  you: 'Toi',
  nobody: 'Personne',
  notPlayedYet: 'Pas encore joué',
  everyonePicked: 'Personne. Toute la bande a choisi son camp.',

  /** « 63 % » */
  percent: (n: number | string) => `${n} %`,
  /** Lettre du résultat (V, D, N) dans la forme et le calendrier. */
  resultLetter: { V: 'V', D: 'D', N: 'N' } as Record<'V' | 'D' | 'N', string>,

  /** Pendant et après le match. */
  /** Quart-temps : « Q1 »… puis « Prol. ». */
  period: (p: number) => (p > 4 ? 'Prol.' : `Q${p}`),
  /** « Les <b>Bills</b> ont la balle » : morceaux de la phrase, l'équipe (mise en valeur) au milieu. */
  hasBall: <T>(team: T) => ['Les ', team, ' ont la balle'] as const,
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

  /** Avant le match. */
  favoriteTitle: 'Le favori',
  /** « Les <b>Bills</b>, avec environ 3,5 pts d’avance attendus » : morceaux, l'équipe au milieu. */
  favorite: <T>(team: T, spread: string | null) =>
    ['Les ', team, spread ? `, avec environ ${spread} pts d’avance attendus` : ''] as const,
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
  /** Infobulle d'un match de la forme : « Victoire contre KC 24-17 », « Défaite chez BUF 10-31 ». */
  formGame: (result: 'V' | 'D' | 'N', home: boolean, opponent: string, score: string) =>
    `${RESULT[result]} ${home ? 'contre' : 'chez'} ${opponent} ${score}`,
  injuriesTitle: 'Infirmerie',
  injuriesHelp: 'Les forfaits officiels tombent en général la veille ou l’avant-veille du match.',
  noInjuries: 'Aucun blessé signalé pour ce match.',
  injuryStatus: { out: 'Forfait', doubtful: 'Douteux', questionable: 'Incertain' },
  injuredReserve: (n: number) => `+ ${n} en liste des blessés (absent${n > 1 ? 's' : ''} depuis plusieurs semaines)`
};
