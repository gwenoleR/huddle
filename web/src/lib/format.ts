/** Dates and small words, in the instance language and the phone's time zone. */
import { t } from './i18n';

const fmt = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(t.common.locale, opts).format(ms);

/** "dim. 22:25" */
export const kickoffLabel = (ms: number) => fmt(ms, { weekday: 'short', hour: t.common.hour, minute: '2-digit' });

/** "dim. 9 nov." */
export const dayLabel = (ms: number) => fmt(ms, { weekday: 'short', day: 'numeric', month: 'short' });

/** "19:40" */
export const timeLabel = (ms: number) => fmt(ms, { hour: t.common.hour, minute: '2-digit' });

/** "mar. 19:40" (short day and time) */
export const dayTimeLabel = (ms: number) => fmt(ms, { weekday: 'short', hour: t.common.hour, minute: '2-digit' });

/** "1er", "2e" */
export const ordinal = (n: number) => t.common.ordinal(n);

