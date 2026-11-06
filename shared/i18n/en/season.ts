/** Season recap and trophies (display). */
import type { Messages } from '../index';
import { common } from './common';

export const season = {
  /** Where the points come from: "81 correct picks + 8 bonus", "40 carried over + 5 in the app". */
  pointsOrigin: (r: { good: number; startPoints: number; bonus: number; points: number }) => {
    if (r.startPoints) return `${r.startPoints} carried over + ${r.points - r.startPoints} in the app`;
    return `${common.goodPicks(r.good)}${r.bonus ? ` + ${r.bonus} bonus` : ''}`;
  },

  /** "2026 season in progress · 120 games played" */
  eyebrow: (season: number | string, finished: boolean, games: number) =>
    `${season} season ${finished ? 'complete' : 'in progress'} · ${common.matches(games)} played`,
  title: 'Season recap',
  championTitle: (finished: boolean) => (finished ? 'Season champion' : 'Leading for now'),
  /** Unit after the champion's points (preceded by a space). */
  pointsUnit: ' pts',
  standingsTitle: (finished: boolean) => (finished ? 'Final standings' : 'Current standings'),
  trophiesTitle: "The crew's trophies",
  noTrophiesYet: 'Trophies show up once the first games are played.',
  toWinTitle: (finished: boolean) => (finished ? 'Not awarded this season' : 'Still up for grabs'),
  previousSeasons: 'Previous seasons',
  otherSeasons: 'Other seasons',

  /** Line under a trophy's title: "Gwen · 12 correct picks in a row", or nobody. */
  awardLine: (who: string | null, detail: string | null, finished: boolean) =>
    who ? `${who} · ${detail}` : finished ? 'Nobody' : 'Nobody yet',

  /** A trophy's dialog */
  itsYou: "That's you!",
  nobody: (finished: boolean) => (finished ? 'Nobody won it this season.' : "Nobody's earned it yet. It's up for grabs."),
  howToWin: 'How to win it',
  ruleNote: 'Only finished games count. The trophy can change hands at any time.',
  close: 'Got it'
} satisfies Messages['season'];
