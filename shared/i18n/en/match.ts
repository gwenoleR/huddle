/** Match screen: before (favorite, form, injuries), during and after (stats). */
import type { Messages } from '../index';

const RESULT = { W: 'Win', L: 'Loss', T: 'Tie' } as const;

export const match = {
  /** My name in the group's lists. */
  you: 'You',
  nobody: 'Nobody',
  notPlayedYet: "Hasn't picked yet",
  everyonePicked: 'Nobody. The whole crew has picked a side.',

  /** "63%" */
  percent: (n: number | string) => `${n}%`,
  /** Result letter (W, L, T) in the form and the schedule. */
  resultLetter: { W: 'W', L: 'L', T: 'T' } as Record<'W' | 'L' | 'T', string>,

  /** During and after the game. */
  /** Quarter: "Q1"… then "OT". */
  period: (p: number) => (p > 4 ? 'OT' : `Q${p}`),
  /** "The <b>Bills</b> have the ball": sentence pieces, the (highlighted) team in the middle. */
  hasBall: <T>(team: T): readonly [string, T, string] => ['The ', team, ' have the ball'],
  redZone: 'Red zone',
  lastPlay: (text: string, abbr: string | null) => `Last play: ${text}${abbr ? ` (${abbr})` : ''}`,
  winChances: 'Win probability',
  gameStory: 'How it played out',
  byEspn: 'per ESPN',
  myPickChances: (pct: number) => `Your pick: ${pct}% chance to win`,
  chartLabel: (away: string, home: string) => `Win probability over the game: ${away} on top, ${home} on the bottom`,
  statsTitle: 'Team stats',
  leadersTitle: 'Top performers',
  scoringTitle: 'Scoring summary',

  /** Before the game. */
  favoriteTitle: 'The favorite',
  /** "The <b>Bills</b>, favored by about 3.5 pts": pieces, the team in the middle. */
  favorite: <T>(team: T, spread: string | null): readonly [string, T, string] => [
    'The ',
    team,
    spread ? `, favored by about ${spread} pts` : ''
  ],
  tossUp: 'A coin flip for the sportsbooks',
  winChancesEspn: 'Win probability (ESPN)',
  chancesLabel: (away: string, awayPct: number, home: string, homePct: number) => `${away} ${awayPct}%, ${home} ${homePct}%`,
  recordTitle: 'Record and form',
  colRecord: 'Record',
  colVenue: 'Home / Away',
  atHome: 'home',
  onTheRoad: 'away',
  seeNflStandings: 'See NFL standings',
  recordHelp: 'Record is wins-losses. Form runs from oldest to most recent.',
  /** Tooltip of a game in the form: "Win vs KC 24-17", "Loss at BUF 10-31". */
  formGame: (result: 'W' | 'L' | 'T', home: boolean, opponent: string, score: string) =>
    `${RESULT[result]} ${home ? 'vs' : 'at'} ${opponent} ${score}`,
  injuriesTitle: 'Injury report',
  injuriesHelp: 'Official game statuses usually come out a day or two before the game.',
  noInjuries: 'No injuries reported for this game.',
  injuryStatus: { out: 'Out', doubtful: 'Doubtful', questionable: 'Questionable' },
  injuredReserve: (n: number) => `+ ${n} on injured reserve (out for several weeks)`
} satisfies Messages['match'];
