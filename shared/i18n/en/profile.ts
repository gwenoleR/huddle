/** Player profile and settings. */
import type { Messages } from '../index';
import { common } from './common';

export const profile = {
  /** Under the name: "2nd of 8 · 81 pts · 2026 season"; `rank` already formatted. */
  subtitle: (rank: string, players: number, points: number, season: number | string) =>
    `${rank} of ${players} · ${points} pts · ${season} season`,
  goodPicksLabel: (startWeek: number) => (startWeek > 1 ? `correct picks since W${startWeek}` : 'correct picks this season'),
  /** "62%" */
  percent: (pct: number) => `${pct}%`,
  successLabel: 'hit rate',
  streakLabel: 'in a row',

  byWeek: 'Week by week',
  /** Carried-over points line: "W1–W8" or "Before". */
  carriedWeeks: (startWeek: number) => (startWeek > 1 ? `W1–W${startWeek - 1}` : 'Before'),
  carriedFrom: 'Starting points',
  carriedPoints: (points: number) => `${points} pts`,
  byWeekHelp: (playoffs: number) => `Weeks at 70% or better are in green. In the playoffs, a correct pick is worth ${common.points(playoffs)}.`,

  settings: 'Settings',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeAuto: 'Auto',
  install: 'Add the app to your home screen',
  installIos: 'In Safari: tap Share, then "Add to Home Screen".',
  installOther: 'In Chrome: ⋮ menu, then "Install app" or "Add to Home screen".',

  admin: 'Admin',
  adminHelp: 'Players, bonus, ESPN data, history import',
  logout: 'Log out',

  newVersion: 'New version available: reload',
  version: (version: string, server: string | null) => `Version ${version}${server ? ` · server ${server}` : ''}`,

  notifications: 'Notifications',
  pushError: "Couldn't turn on notifications.",
  pushOn: "On: a reminder 1 h before a game you haven't picked, and results at the end of the week.",
  pushOff: "A reminder 1 h before a game you haven't picked, and results at the end of the week.",
  pushDenied: "Blocked in your phone's settings. Allow them for this site, then come back here.",
  pushNeedsInstall: 'On iPhone, add the app to your home screen first, then open it from the icon.',
  pushUnsupported: "This browser doesn't support notifications.",
  pushEnable: 'Turn on notifications',
  pushTest: 'Send me a test',
  pushTestSent: 'Notification sent',
  pushTestNoDevice: 'No subscribed device',
  pushDisable: 'Turn off'
} satisfies Messages['profile'];
