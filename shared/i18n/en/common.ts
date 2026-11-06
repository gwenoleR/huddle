/** Words and formats shared by everyone: weeks, numbers, generic errors. */
import type { Messages } from '../index';

/** "1 pick", "2 picks", "0 picks". For words with an irregular plural, pass the plural. */
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1st", "2nd", "3rd", "4th", "11th", "21st"… */
const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

const PLAYOFF_WEEKS: Record<number, { short: string; long: string }> = {
  19: { short: 'Wild Card', long: 'Wild Card' },
  20: { short: 'Div.', long: 'Divisional Round' },
  21: { short: 'Conf.', long: 'Conference Championships' },
  22: { short: 'Super Bowl', long: 'Super Bowl' }
};

export const common = {
  /** Language of dates and numbers (Intl) and of the page (<html lang>). */
  locale: 'en-US',
  htmlLang: 'en',
  /** How hours are written: \"1:00 PM\" (no leading zero, 12-hour clock from en-US). */
  hour: 'numeric',

  /** App name if the instance doesn't set one (APP_NAME). */
  appName: 'Huddle',
  appShortName: 'Huddle',
  appDescription: 'NFL picks with your crew',

  count,
  pronos: (n: number) => count(n, 'pick'),
  goodPicks: (n: number) => count(n, 'correct pick'),
  matches: (n: number) => count(n, 'game'),
  points: (n: number) => count(n, 'pt', 'pts'),
  /** "1st", "2nd" */
  ordinal,
  /** Same as ordinal in English (seed, position). */
  ordinalFem: ordinal,

  /** App weeks: 1 to 18 = regular season, then 19 Wild Card, 20 Div., 21 Conf., 22 Super Bowl. */
  weekLabel: (week: number, long = false) => {
    const w = PLAYOFF_WEEKS[week];
    if (w) return long ? w.long : w.short;
    return long ? `Week ${week}` : `W${week}`;
  },

  /** Scoring reminder at the top of the leaderboard: "1 pt per correct pick, 2 in the playoffs". */
  scoring: (regular: number, playoffs: number) =>
    `${count(regular, 'pt', 'pts')} per correct pick${playoffs !== regular ? `, ${playoffs} in the playoffs` : ''}`,

  errors: {
    network: 'No connection. Try again in a moment.',
    server: 'Oops, the server is acting up.',
    unexpected: 'Something went wrong.'
  }
} satisfies Messages['common'];
