/** Joins CSS classes, skipping empty values. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
