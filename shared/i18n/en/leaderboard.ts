/** The group's leaderboard. */
import type { Messages } from '../index';
import { common } from './common';

export const leaderboard = {
  title: 'Standings',
  tabsLabel: 'Which standings',
  tabBand: 'The crew',
  tabNfl: 'NFL',
  scopeSeason: 'Season',
  scopeWeek: 'Week',

  /** Header: "2026 season · 1 pt per correct pick, 2 in the playoffs" or "… · started in Week 9". */
  eyebrow: (season: number | string, startWeek: number, scoring: string) =>
    `${season} season · ${startWeek > 1 ? `started in Week ${startWeek}` : scoring}`,

  liveBadge: (games: number) => `Live · ${common.matches(games)}`,
  liveTitle: 'If it ends like this…',
  liveHelp: 'The standings factor in live scores and update on their own. ✓ picks on track, ✗ picks in trouble.',

  /** Under the name, during games: "70 pts right now · ✓2 ✗1 · ↑1". */
  liveRecord: (points: number, winning: number, losing: number, move: number) => {
    const arrow = move > 0 ? ` · ↑${move}` : move < 0 ? ` · ↓${-move}` : '';
    const now = `${points} pts right now`;
    if (!winning && !losing) return `${now} · nothing at stake${arrow}`;
    return `${now} · ✓${winning} ✗${losing}${arrow}`;
  },
  /** Under the name, weekly leaderboard: "8 of 13 correct". */
  weekRecord: (good: number, played: number) => (played ? `${good} of ${played} correct` : 'No finished games yet'),
  /**
   * Line under the name in the season leaderboard: "81 / 135", with carried-over points only
   * for those who have some (joined mid-season) and the bonus if any.
   */
  seasonRecord: (r: { good: number; played: number; startPoints: number; bonus: number }, startWeek: number) => {
    const bonus = r.bonus ? ` · +${r.bonus} bonus` : '';
    if (!r.played) return r.startPoints ? `${r.startPoints} starting pts${bonus}` : `No finished games yet${bonus}`;
    const since = startWeek > 1 ? ` since W${startWeek}` : '';
    const kept = r.startPoints ? ` · ${r.startPoints} carried over` : '';
    return `${r.good} / ${r.played}${since}${kept}${bonus}`;
  },

  /** Rank superscript in the big card: "st" (1st), "nd" (2nd), "th" (4th). */
  rankSuffix: (rank: number) => common.ordinal(rank).replace(/^\d+/, ''),
  headline: (rank: number, live: boolean) => {
    if (live)
      return rank === 1
        ? "You'd finish on top"
        : rank <= 3
          ? `You'd finish ${common.ordinal(rank)}, on the podium`
          : `You'd finish ${common.ordinal(rank)}`;
    return rank === 1 ? "You're running the show" : rank <= 3 ? "You're on the podium" : 'Hang in there';
  },
  aloneInFront: 'All alone up there',
  tiedWith: (name: string) => `Tied with ${name}`,
  aheadOf: (gap: number, name: string) => `${common.points(gap)} ahead of ${name}`,
  /** "3 pts behind Gwen · 2 pts ahead of Bea" */
  behind: (gap: number, leader: string, below: { gap: number; name: string } | null) =>
    `${common.points(gap)} behind ${leader}${below ? ` · ${common.points(below.gap)} ahead of ${below.name}` : ''}`,

  recapButton: 'Weekly recap to share',
  seasonButton: 'Season recap',
  bonusButton: 'End-of-season bonus',
  previousSeasons: 'Previous seasons'
} satisfies Messages['leaderboard'];
