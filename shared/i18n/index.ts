/**
 * Internationalisation, partagée par le serveur et l'appli.
 *
 * Les textes sont des objets TypeScript : `t.leaderboard.title` pour un texte fixe,
 * `t.common.pronos(3)` quand il dépend de valeurs (pluriels, noms, nombres). Pas de clé en chaîne
 * ni d'interpolation à l'exécution : le typecheck vérifie chaque usage et chaque traduction.
 *
 * Pour ajouter une langue : copier fr/ en en/, traduire, l'ajouter à DICTIONARIES. L'instance
 * choisit sa langue avec APP_LANG.
 */
import { fr } from './fr';

/** Forme d'un dictionnaire : celle du français. */
export type Messages = typeof fr;

export const DICTIONARIES: Record<string, Messages> = { fr };

export const DEFAULT_LANG = 'fr';

/** Le dictionnaire d'une langue ; le français si elle n'existe pas (encore). */
export function messages(lang: string | undefined): Messages {
  return (lang && DICTIONARIES[lang]) || DICTIONARIES[DEFAULT_LANG];
}

export const isLang = (lang: string | undefined): boolean => !!lang && lang in DICTIONARIES;
