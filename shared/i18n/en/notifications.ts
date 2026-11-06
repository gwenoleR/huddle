/** Notifications sent by the server (reminders, results, bonus). */
import type { Messages } from '../index';
import { common } from './common';

export const notifications = {
  /** Test notification, from the profile. */
  testTitle: 'It works!',
  testBody: (name: string) => `Hey ${name}, notifications are on.`,

  /** Reminder ~1 h before a kickoff: "Kickoff at 7:00 PM: KC @ BUF, DAL @ NYG". */
  reminderTitle: (missing: number) => (missing > 1 ? `You're missing ${missing} picks` : "You're missing a pick"),
  reminderBody: (hour: string, games: string[]) => `Kickoff at ${hour}: ${games.join(', ')}`,

  /** End of week: "Week 9 is in the books", "You went 8 for 13. You're 2nd with 70 pts." */
  weekDoneTitle: (week: string) => `${week} is in the books`,
  weekDoneBody: (good: number, total: number, rank: number, points: number) =>
    `You went ${good} for ${total}. You're ${common.ordinal(rank)} with ${common.points(points)}.`,

  /** The pick flips late in the game (score "KC 24–21 BUF", detail "Q4 · 2:00"). */
  flipTitle: (good: boolean, done: boolean) =>
    good ? (done ? 'Late comeback, your pick hits!' : "It's turning your way!") : done ? 'Heartbreaker at the wire…' : "Uh-oh, it's slipping…",
  flipBody: (f: { done: boolean; good: boolean; leader: string; picked: string; score: string; detail: string | null }) =>
    f.done
      ? `The ${f.leader} win it at the wire: ${f.score}. ${f.good ? 'Your pick is a hit!' : `Your ${f.picked} pick goes down.`}`
      : `The ${f.leader} take the lead: ${f.score} (${f.detail}). ${f.good ? "Your pick is back on track." : `Your ${f.picked} pick is in trouble.`}`,

  /** End-of-season bonus: opening, then a reminder before closing. */
  bonusOpenTitle: 'End-of-season bonus is open 🏆',
  bonusOpenBody: (max: number) =>
    `AFC champion, NFC champion and Super Bowl winner: up to ${max} pts. Pick before the Wild Card.`,
  bonusReminderTitle: 'Your end-of-season bonus 🏆',
  bonusReminderBody: (max: number) => `One hour left to pick your champions (up to ${max} pts).`
} satisfies Messages['notifications'];
