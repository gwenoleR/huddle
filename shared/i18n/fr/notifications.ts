/** Notifications sent by the server (reminders, results, bonus). */
import { common } from './common';

export const notifications = {
  /** Test notification, from the profile. */
  testTitle: 'Ça marche !',
  testBody: (name: string) => `Salut ${name}, les notifications sont activées.`,

  /** Reminder ~1 h before a kickoff: « Coup d'envoi à 19:00 : KC @ BUF, DAL @ NYG ». */
  reminderTitle: (missing: number) => (missing > 1 ? `Il te manque ${missing} pronos` : 'Il te manque un prono'),
  reminderBody: (hour: string, games: string[]) => `Coup d'envoi à ${hour} : ${games.join(', ')}`,

  /** End of week: « Semaine 9 terminée », « Tu as fait 8 sur 13. Tu es 2e avec 70 pts. » */
  weekDoneTitle: (week: string) => `${week} terminée`,
  weekDoneBody: (good: number, total: number, rank: number, points: number) =>
    `Tu as fait ${good} sur ${total}. Tu es ${common.ordinal(rank)} avec ${points} pts.`,

  /** The pick flips late in the game (score « KC 24–21 BUF », detail « Q4 · 2:00 »). */
  flipTitle: (good: boolean, done: boolean): string =>
    good ? (done ? 'Renversement final, ton prono passe !' : 'Ça tourne pour toi !') : done ? 'Crucifié sur le fil…' : 'Aïe, ça bascule…',
  flipBody: (f: { done: boolean; good: boolean; leader: string; picked: string; score: string; detail: string | null }) =>
    f.done
      ? `Les ${f.leader} l’emportent sur le fil : ${f.score}. ${f.good ? 'Ton prono est bon !' : `Ton prono sur les ${f.picked} tombe à l’eau.`}`
      : `Les ${f.leader} passent devant : ${f.score} (${f.detail}). ${f.good ? 'Ton prono redevient bon.' : `Ton prono sur les ${f.picked} est en danger.`}`,

  /** End-of-season bonus: opening, then a reminder before closing. */
  bonusOpenTitle: 'Bonus de fin de saison ouvert 🏆',
  bonusOpenBody: (max: number) =>
    `Champion AFC, champion NFC et vainqueur du Super Bowl : jusqu'à ${max} pts. À choisir avant la Wild Card.`,
  bonusReminderTitle: 'Ton bonus de fin de saison 🏆',
  bonusReminderBody: (max: number) => `Plus qu'une heure pour choisir tes champions (jusqu'à ${max} pts).`
};
