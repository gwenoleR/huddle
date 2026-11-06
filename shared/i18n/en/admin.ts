/** Administration page. */
import type { Messages } from '../index';
import { common, count } from './common';

export const admin = {
  back: 'Profile',
  title: 'Admin',
  adminsOnly: 'Group admins only.',
  seasonSection: 'Season',
  dataSection: 'Data',

  /** ESPN calls status line; `pausedUntil` already formatted ("7:40 PM"). */
  espn: (lastHour: number, lastDay: number, errors: number, pausedUntil: string | null) => {
    if (pausedUntil) return `ESPN asked us to slow down: calls paused until ${pausedUntil}`;
    return `${count(lastHour, 'ESPN call')} in the last hour${errors ? ` · ${errors} failed` : ''} · ${lastDay} in 24 h`;
  },

  // ESPN sync
  syncDone: (games: number) => `Sync done: ${count(games, 'game')}`,
  syncLabel: 'ESPN data',
  /** "Last sync Tue 7:40 PM · " or "Failed Tue 7:40 PM · "; `when` already formatted. */
  syncWhen: (ok: boolean, when: string) => `${ok ? 'Last sync' : 'Failed'} ${when} · `,
  syncGames: (games: number) => `${count(games, 'game')} in the database`,
  syncing: 'Syncing… (≈ 15 s)',
  syncNow: 'Sync now',

  // End-of-season bonus
  bonusAfc: 'AFC champion',
  bonusNfc: 'NFC champion',
  bonusSb: 'Super Bowl winner',
  bonusScaleSaved: 'Bonus points saved',
  bonusLabel: 'End-of-season bonus',
  bonusOnHelp: 'On: visible to everyone, points count in the standings.',
  bonusOffHelp: 'Off: hidden from everyone, no points counted.',
  bonusDisabled: 'Bonus turned off',
  bonusEnabled: 'Bonus turned on',
  bonusDisable: 'Turn off the bonus',
  bonusEnable: 'Turn on the bonus',
  pointsUnit: 'pts',
  bonusSaveScale: 'Save bonus points',
  revealLabel: "Reveal the crew's picks",
  revealWildcard: 'At the Wild Card',
  revealSuperbowl: 'At the Super Bowl',
  revealed: (at: 'wildcard' | 'superbowl') => `Picks revealed ${at === 'wildcard' ? 'at the Wild Card' : 'at the Super Bowl'}`,
  revealWildcardHelp: "As soon as picks lock: everyone can follow who's still alive during the playoffs.",
  revealSuperbowlHelp: 'At Super Bowl kickoff: suspense until the very end, bonus points added at that moment.',

  // Players
  added: (name: string) => `${name} added`,
  confirmResetPin: (name: string) => `Reset ${name}'s PIN? They'll choose a new one next time they log in.`,
  pinReset: (name: string) => `${name}'s PIN reset`,
  renamePrompt: (name: string) => `New name for ${name}`,
  renamed: (before: string, after: string) => `${before} is now ${after}`,
  noLongerAdmin: (name: string) => `${name} is no longer an admin`,
  nowAdmin: (name: string) => `${name} is now an admin`,
  confirmRemove: (name: string) => `Remove ${name}? Their picks and points will be gone for good.`,
  removed: (name: string) => `${name} removed`,
  playersSection: (n: number) => `Players · ${n}`,
  tagAdmin: 'admin',
  tagNoPin: 'not logged in yet',
  tagStartPoints: (points: number) => `${points} starting pts`,
  rename: 'Rename',
  resetPin: 'Reset PIN',
  removeAdmin: 'Remove admin',
  makeAdmin: 'Make admin',
  remove: 'Remove',
  addPlayer: 'Add a player',
  firstName: 'First name',
  startPoints: 'Starting points (if joining mid-season)',
  add: 'Add',

  // History import
  imported: (picks: number) => `${common.pronos(picks)} imported`,
  importLabel: 'Import history',
  importHelp:
    'Weeks played elsewhere, as a CSV: a header row (", Home, Away, Pick GW, Pick AU…", first two letters of each first name), then one row per game ("Week1" on the first game of each week). Starting points of the players in the file are reset to 0.',
  chooseCsv: 'Choose a CSV file',
  importPreview: (picks: number, games: number, players: string[]) =>
    `${common.pronos(picks)} across ${common.matches(games)}, for ${players.join(', ')}.`,
  importNow: 'Import'
} satisfies Messages['admin'];
