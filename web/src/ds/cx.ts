/** Assemble des classes CSS en ignorant les valeurs vides. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
