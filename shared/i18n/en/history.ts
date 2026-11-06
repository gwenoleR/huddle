/** CSV history import (server messages). */
import type { Messages } from '../index';
export const history = {
  emptyFile: 'Empty file: it needs a header row, then one row per game.',
  unreadableWeek: (line: number, cell: string) => `Line ${line}: can't read week "${cell}"`,
  gameBeforeFirstWeek: (line: number) => `Line ${line}: game listed before the first week`,

  /** The game a problem refers to: "W9 KC @ BUF" (raw week number from the file). */
  where: (week: number, away: string, home: string) => `W${week} ${away} @ ${home}`,
  unknownTeam: (where: string) => `${where}: unknown team`,
  gameNotFound: (where: string) => `${where}: game not found (sync not done yet?)`,
  duplicateGame: (where: string) => `${where}: duplicate game`,
  ambiguousPlayer: (initials: string, names: string[]) =>
    `player "${initials}" is ambiguous: ${names.join(', ')} all start with those letters`,
  unknownPlayer: (initials: string) => `unknown player "${initials}": add them first, or fix their column header`,
  pickNotInGame: (where: string, initials: string, pick: string) => `${where}: ${initials}'s pick "${pick}" isn't playing in this game`,

  /** All problems, one per line. */
  notImported: (problems: string[]) => `History not imported:\n- ${problems.join('\n- ')}`
} satisfies Messages['history'];
