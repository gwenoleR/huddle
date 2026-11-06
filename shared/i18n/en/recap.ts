/** Shareable weekly recap (screen and image). */
import type { Messages } from '../index';
export const recap = {
  eyebrow: 'Send it to the group chat',
  /** "Recap · Week 9", or "Weekly recap" before loading. */
  title: (label: string | null) => (label ? `Recap · ${label}` : 'Weekly recap'),
  /** The image's alt text; `label` is the week's name ("Week 9"). */
  imageAlt: (label: string) => `${label} recap: podium, overall standings and blunder of the week`,
  incomplete: (finals: number, total: number) =>
    `Week not over yet: ${finals} of ${total} games played. The recap fills in as games finish.`,
  share: 'Share',
  save: 'Save image',
  /** Share title: "Huddle · Week 9" */
  shareTitle: (appShortName: string, label: string) => `${appShortName} · ${label}`,
  shareFailed: "Couldn't share, save the image instead.",

  /** Texts drawn on the image */
  image: {
    subtitle: (complete: boolean, finals: number, total: number) =>
      complete ? `The recap · ${total} games` : `Early recap · ${finals} of ${total} games`,
    points: (n: number) => (n === 1 ? 'point' : 'points'),
    general: 'OVERALL STANDINGS',
    blunderTitle: '✗ BLUNDER OF THE WEEK',
    /** "Gwen and Bea took the Jets", "The whole crew took the Jets" */
    blunder: (wrong: string[], everyone: boolean, team: string) => {
      const who = everyone ? 'The whole crew' : names(wrong);
      return `${who} took the ${team}`;
    },
    noBlunder: 'No blunders this week. Respect.',
    failed: "Couldn't create the image"
  }
} satisfies Messages['recap'];

/** "Gwen", "Gwen and Bea", "Gwen, Bea and Max" */
function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}
