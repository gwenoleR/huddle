/**
 * Back from a match page: the games list resumes where it was left.
 * Everywhere else (another week, another tab), the list starts back at the top.
 *
 * The position is saved only when leaving the list for a match page; it is forgotten as soon
 * as we go anywhere other than a match page or the list, and used only once.
 */
import { type RefObject, useLayoutEffect } from 'react';

let saved: { key: string; top: number } | null = null;

/** Pages from which going back must restore the position: match pages. */
export const isDetail = (hash: string) => /^#\/match\//.test(hash);
/** Pages that don't discard the position: the match page itself and the games list. */
const keepsMemory = (hash: string) => /^#\/match(\/|es(\/|$)|$)/.test(hash);

if (typeof window !== 'undefined') {
  addEventListener('hashchange', () => {
    if (!keepsMemory(location.hash)) saved = null;
  });
}

/** Leaving the list: save the position only when heading to a match page. */
export function leaveList(key: string, top: number, to: string) {
  saved = isDetail(to) ? { key, top } : null;
}

/** Arriving on the list: the position to restore (only once), otherwise the very top. */
export function enterList(key: string): number {
  const top = saved?.key === key ? saved.top : 0;
  saved = null;
  return top;
}

/**
 * To put on the screen's first element: the scrolling area is its parent (.screen).
 * `ready` means the list is displayed (otherwise the height isn't there yet to scroll back to).
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
