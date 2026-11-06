/** Texts of the design system components (navigation, statuses, game card). */
import type { Messages } from '../index';

export const ds = {
  loading: 'Loading…',

  /** Bottom navigation bar. */
  navLabel: 'Main navigation',
  nav: { matches: 'Games', standings: 'Standings', profile: 'Profile' },

  /** A game's status pill (and the pick's verdict once final). */
  status: {
    open: 'Open',
    locked: 'Locked',
    live: 'Live',
    final: 'Final',
    win: 'Nailed it',
    loss: 'Missed'
  },

  weekPickerLabel: 'Week',

  /** Game card. */
  myPick: 'Your pick',
  /** A team's button, for screen readers: "Bills, your pick". */
  sideLabel: (team: string, picked: boolean) => `${team}${picked ? ', your pick' : ''}`,
  nobodyPicked: 'No picks yet',
  /** Split bar: "2 for Bills, 1 for Chiefs". */
  splitLabel: (awayCount: number, away: string, homeCount: number, home: string) =>
    `${awayCount} for ${away}, ${homeCount} for ${home}`,

  /** Leaderboard row. */
  you: 'you',
  pointsUnit: 'pts',

  /** Label before a list of links: "Previous seasons:". */
  listLabel: (label: string) => `${label}:`
} satisfies Messages['ds'];
