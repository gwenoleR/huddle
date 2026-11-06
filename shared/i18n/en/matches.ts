/** The week's games list: Matches screen, game card, week picker, statuses. */
import type { Messages } from '../index';
import { common } from './common';

export const matches = {
  /** Link to the match screen, depending on the game's state and whether picks count. */
  detailLink: (status: 'scheduled' | 'live' | 'final' | 'postponed', counted: boolean) => {
    const picks = counted ? ' and picks' : '';
    if (status === 'final') return `Game stats${picks}`;
    if (status === 'live') return `Follow the game${picks}`;
    return counted ? 'Favorite, form, injuries and picks' : 'Favorite, form and injuries';
  },

  /** "2026 season · Regular season" */
  eyebrow: (season: number, playoffs: boolean) => `${season} season · ${playoffs ? 'Playoffs' : 'Regular season'}`,
  /** "3 / 14 picks" counter: the word after the numbers. */
  counterUnit: 'picks',
  playoffPoints: (points: number) => `${common.points(points)} per correct pick`,
  /** "3 left to pick · next kickoff Sun 1:00 PM" */
  remaining: (n: number, kickoff: string) => `${n} left to pick · next kickoff ${kickoff}`,
  notCountedYet: (startWeek: number) => `Picks count starting in Week ${startWeek}. Just the scores for now.`,
  noGames: 'No games announced for this week yet.',
  /** Empty split for a game from before picks started counting. */
  beforeApp: 'Before the app',
  allDone: "All your picks are in. Now we wait!",
  /** Times are the phone's: no time zone to specify. */
  footer: (games: number) => `${common.matches(games)} this week`,

  /** Status on the card. */
  live: (detail: string) => `Live · ${detail}`,
  postponed: 'Postponed',
  openPoints: (points: number) => `Open · ${common.points(points)}`,

  /** End-of-season bonus card. */
  bonusTitle: 'End-of-season bonus',
  bonusMine: (lockDay: string) => `Your picks are in · you can change them until ${lockDay}`,
  bonusOpen: (max: number, lockDay: string) => `Up to ${max} pts up for grabs · pick before ${lockDay}`,
  bonusRevealed: "The crew's picks are revealed",
  bonusLocked: 'Picks locked · revealed at Super Bowl kickoff'
} satisfies Messages['matches'];
