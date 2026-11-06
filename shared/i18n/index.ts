/**
 * Internationalization, shared by the server and the app.
 *
 * Texts are TypeScript objects: `t.leaderboard.title` for a fixed text,
 * `t.common.pronos(3)` when it depends on values (plurals, names, numbers). No string keys
 * and no runtime interpolation: the typecheck verifies every usage and every translation.
 *
 * Languages: French (fr/, the reference whose shape every other dictionary must match) and
 * English (en/). To add one: copy fr/ to a new folder, translate, add it to DICTIONARIES.
 * The instance picks its language with APP_LANG.
 */
import { fr } from './fr';
import { en } from './en';

/** Shape of a dictionary: that of the French one. */
export type Messages = typeof fr;

export const DICTIONARIES: Record<string, Messages> = { fr, en };

export const DEFAULT_LANG = 'fr';

/** A language's dictionary; French if it doesn't exist (yet). */
export function messages(lang: string | undefined): Messages {
  return (lang && DICTIONARIES[lang]) || DICTIONARIES[DEFAULT_LANG];
}

export const isLang = (lang: string | undefined): boolean => !!lang && lang in DICTIONARIES;
