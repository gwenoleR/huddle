/** Season trophies: titles, rules and details (computed by the server). Keys = trophy ids. */
import type { Messages } from '../index';
import { common } from './common';

export const trophies = {
  'best-week': {
    title: 'Best week',
    rule: 'Most correct picks in a single week. On a tie, the week with fewer games wins (13 of 13 beats 13 of 16).',
    /** "13 of 14 in Week 9" (week = the week's long label). */
    detail: (good: number, finals: number, week: string) => `${good} of ${finals} in ${week}`
  },
  sniper: {
    title: 'Sharpshooter',
    rule: "Best hit rate of the season. You need at least 10 games played to qualify, so going 2 for 2 doesn't cut it.",
    detail: (good: number, played: number) => `${Math.round((good * 100) / played)}% hit rate (${good} of ${played})`
  },
  streak: {
    title: 'Unstoppable',
    rule: "Longest run of correct picks in a row, in kickoff order. You need at least 5 straight. A game with no pick doesn't break the streak.",
    detail: (n: number) => `${common.goodPicks(n)} in a row`
  },
  contrarian: {
    title: 'Contrarian',
    rule: "Most picks against the majority of the crew, right or wrong. Games where the crew is split evenly don't count.",
    detail: (n: number) => `${common.pronos(n)} against the majority`
  },
  heart: {
    title: 'Heart over head',
    rule: 'The team picked most often by a single player. You need to have picked them at least 3 times.',
    detail: (team: string, n: number) => `the ${team}, ${n} times`
  },
  'black-cat': {
    title: 'Black cat',
    rule: 'The team that cost a single player the most picks: they picked them and they lost. Needs at least 3 betrayals.',
    detail: (team: string, n: number) => `the ${team} let them down ${n} times`
  },
  'last-minute': {
    title: 'Down to the wire',
    rule: 'Most picks made (or changed) in the last 15 minutes before kickoff. Needs at least 3.',
    detail: (n: number) => `${common.pronos(n)} in the last 15 minutes`
  },
  nostradamus: {
    title: 'Nostradamus',
    rule: 'Called the Super Bowl winner in the end-of-season bonus, before the Wild Card even started. If several got it, whoever is closest to the Super Bowl total points wins.',
    /** gap = distance from the actual Super Bowl total points (0 = spot on). */
    detail: (team: string, total: number, gap: number) =>
      `Called the ${team} as champs before the Wild Card · ${total} total pts (${gap ? `off by ${gap}` : 'spot on!'})`
  }
} satisfies Messages['trophies'];
