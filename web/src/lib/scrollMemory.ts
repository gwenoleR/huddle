/**
 * Retour d'une fiche match : la liste des matchs reprend là où on l'avait laissée.
 * Partout ailleurs (autre semaine, autre onglet), la liste repart en haut.
 *
 * On retient la position seulement au moment où on quitte la liste pour une fiche ; elle est
 * oubliée dès qu'on va ailleurs que sur une fiche ou la liste, et utilisée une seule fois.
 */
import { type RefObject, useLayoutEffect } from 'react';

let saved: { key: string; top: number } | null = null;

/** Les pages d'où un retour doit retrouver la position : les fiches match. */
export const isDetail = (hash: string) => /^#\/match\//.test(hash);
/** Pages qui ne font pas oublier la position : la fiche elle-même et la liste des matchs. */
const keepsMemory = (hash: string) => /^#\/match(\/|s(\/|$)|$)/.test(hash);

if (typeof window !== 'undefined') {
  addEventListener('hashchange', () => {
    if (!keepsMemory(location.hash)) saved = null;
  });
}

/** On quitte la liste : on retient la position seulement si on part vers une fiche. */
export function leaveList(key: string, top: number, to: string) {
  saved = isDetail(to) ? { key, top } : null;
}

/** On arrive sur la liste : la position à reprendre (une seule fois), sinon tout en haut. */
export function enterList(key: string): number {
  const top = saved?.key === key ? saved.top : 0;
  saved = null;
  return top;
}

/**
 * À poser sur le premier élément de l'écran : la zone qui défile est son parent (.screen).
 * `ready` indique que la liste est affichée (sinon la hauteur n'est pas encore là pour s'y replacer).
 */
export function useScrollMemory(ref: RefObject<HTMLElement | null>, key: string | null, ready: boolean) {
  useLayoutEffect(() => {
    const scroller = ref.current?.parentElement;
    if (!scroller || !key || !ready) return;
    scroller.scrollTop = enterList(key);
    let top = scroller.scrollTop;
    const onScroll = () => (top = scroller.scrollTop);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      leaveList(key, top, location.hash);
    };
  }, [ref, key, ready]);
}
