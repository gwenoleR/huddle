/** Team page and NFL standings. */
import type { Messages } from '../index';
import { common } from './common';

export const team = {
  /** "1st AFC East · 3rd seed", "3rd NFC North · out of the playoffs (11th)", "4th AFC East · eliminated". */
  standing: (divRank: number, division: string, seed: number | null, eliminated: boolean) => {
    const div = `${common.ordinal(divRank)} ${division}`;
    if (eliminated) return `${div} · eliminated`;
    if (!seed) return div;
    return seed <= 7 ? `${div} · ${common.ordinalFem(seed)} seed` : `${div} · out of the playoffs (${common.ordinal(seed)})`;
  },

  /** Team page. */
  bandTitle: (team: string) => `The crew and the ${team}`,
  noBandPicks: 'Nobody has a finished pick on one of their games yet.',
  withThem: (n: number) => `With them ${n}×`,
  against: (n: number) => `Against ${n}×`,
  good: (n: number) => `${n} correct`,
  schedule: 'Schedule',
  bye: 'Bye week',
  /** Before the opponent: at home "vs", away "@". */
  vs: 'vs',
  at: '@',
  live: (score: string | null) => (score ? `Live ${score}` : 'Live'),
  close: 'Close',

  /** NFL standings. */
  nflEyebrow: (season: number | string) => `${season} season · NFL`,
  nflTitle: 'Standings',
  race: 'Playoff race',
  divisions: 'Divisions',
  playoffLine: 'Playoff line',
  divisionWinner: (division: string) => `${common.ordinal(1)} ${division}`,
  wildCard: 'Wild card',
  clinched: 'clinched',
  eliminated: 'eliminated',
  raceHelp:
    'In each conference, 7 teams make the playoffs: the 4 division winners (seeds 1 to 4) and the 3 best of the rest (wild cards). The 1 seed gets a first-round bye.',
  colRecord: 'Record',
  colStreak: 'Streak',
  colDiff: 'Diff.',
  /** Under the name, divisions view: "Seed 3" if in the playoffs, otherwise "11th AFC". */
  seed: (seed: number | null, conference: string, inPlayoffs: boolean) =>
    inPlayoffs ? `Seed ${seed}` : `${seed ? common.ordinal(seed) : '–'} ${conference}`,
  divisionsHelp: 'Streak: consecutive wins (W) or losses (L). Diff.: points scored minus points allowed.'
} satisfies Messages['team'];
