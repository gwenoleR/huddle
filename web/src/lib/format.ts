const TZ = 'Europe/Paris';

const parts = (ms: number, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts }).formatToParts(ms).map((p) => [p.type, p.value]));

/** « dim. 22:25 » */
export function kickoffLabel(ms: number): string {
  const p = parts(ms, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.weekday} ${p.hour}:${p.minute}`;
}

/** « dim. 9 nov. » */
export function dayLabel(ms: number): string {
  const p = parts(ms, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** « 1er », « 2e » */
export const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
