/** End-of-season bonus (players' screen). */
import type { Messages } from '../index';
import { common } from './common';

export const bonus = {
  /** "Playoffs · up to 6 pts up for grabs" */
  eyebrow: (max: number) => `Playoffs · up to ${common.points(max)} up for grabs`,
  title: 'End-of-season bonus',
  off: 'The bonus is turned off this season.',

  /** "AFC champion"; `conf` is the conference abbreviation. */
  champion: (conf: string) => `${conf} champion`,
  sbWinner: 'Super Bowl winner',
  points: (n: number) => common.points(n),
  /** Rules: when picks are revealed (at the Super Bowl or the Wild Card), and the tiebreaker. */
  rules: (revealAtSuperBowl: boolean) =>
    `Picks stay secret until ${revealAtSuperBowl ? 'Super Bowl kickoff' : 'the first Wild Card game'}${
      revealAtSuperBowl ? ' (you can change them until the Wild Card)' : ''
    }. If there's a tie in the final standings, whoever is closest to the total points scored in the Super Bowl wins it.`,

  waitingTitle: 'Not open yet',
  waitingText: "Picks open at the end of the regular season, once all 14 playoff teams are set. You'll get a notification.",

  /** "Pick before Sun, Jan 11 at 7:00 PM" */
  lockAt: (day: string, time: string) => `Pick before ${day} at ${time}`,
  alreadySaved: ' · Your picks are saved, you can still change them',
  /** "Seed 3" */
  seed: (seed: number) => `Seed ${seed}`,
  pickChampionsFirst: 'Pick your two champions first.',
  totalLabel: 'Super Bowl total points',
  totalHelp: 'Both teams combined. Only used to break ties.',
  totalPlaceholder: 'e.g. 47',
  submit: (update: boolean) => (update ? 'Update my picks' : 'Lock in my picks'),
  saved: 'Picks saved. Top secret until kickoff!',

  resultsTitle: 'Results',
  superBowl: 'Super Bowl',
  pending: 'to come',
  /** "Chiefs · 47 total pts" */
  sbResult: (team: string, total: number | null) => `${team} · ${total} total pts`,

  lockedTitle: 'Picks locked 🔒',
  /** Before the reveal; `at` = kickoff day and time if known. */
  lockedText: (at: { day: string; time: string } | null) =>
    `The crew's picks will be revealed at Super Bowl kickoff${at ? `, ${at.day} at ${at.time}` : ''}. Bonus points will hit the standings at that moment.`,

  playersTitle: "The crew's picks",
  you: 'You',
  noPick: 'No pick made in time.',
  /** A pick's line: "AFC: Chiefs", "SB: Chiefs" */
  pickLine: (label: 'AFC' | 'NFC' | 'SB', team: string) => `${label}: ${team}`,
  /** After the chosen winner: " · 47 pts" */
  pickTotal: (total: number) => ` · ${total} pts`,
  /** Distance from the actual total: " (off by 5)" */
  pickGap: (gap: number) => ` (off by ${gap})`,

  chose: 'Picked by',
  notChosen: (locked: boolean) => (locked ? 'No pick' : 'Not yet'),
  nobody: 'Nobody'
} satisfies Messages['bonus'];
