/** Dates et petits mots, dans la langue de l'instance et le fuseau horaire du téléphone. */
import { t } from './i18n';

const fmt = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(t.common.locale, opts).format(ms);

/** « dim. 22:25 » */
export const kickoffLabel = (ms: number) => fmt(ms, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** « dim. 9 nov. » */
export const dayLabel = (ms: number) => fmt(ms, { weekday: 'short', day: 'numeric', month: 'short' });

/** « 19:40 » */
export const timeLabel = (ms: number) => fmt(ms, { hour: '2-digit', minute: '2-digit' });

/** « mar. 19:40 » (jour court et heure) */
export const dayTimeLabel = (ms: number) => fmt(ms, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** « 1er », « 2e » */
export const ordinal = (n: number) => t.common.ordinal(n);

