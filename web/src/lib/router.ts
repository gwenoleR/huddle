import { useEffect, useState } from 'react';

export type Route =
  | { name: 'matches'; week?: number }
  | { name: 'match'; id: string }
  | { name: 'standings'; nfl?: boolean }
  | { name: 'profile' }
  | { name: 'admin' }
  | { name: 'season'; season?: number }
  | { name: 'bonus' }
  | { name: 'recap'; week?: number };

/**
 * Older French paths (#/matchs, #/classement, #/profil, #/bilan) still resolve: they may live in
 * notifications already received, bookmarks or the start URL of an installed app.
 */
const ALIASES: Record<string, string> = { matchs: 'matches', classement: 'standings', profil: 'profile', bilan: 'season' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const num = (v: string | undefined) => (v ? Number(v) : undefined);
  switch (ALIASES[parts[0]] ?? parts[0]) {
    case 'match':
      return parts[1] ? { name: 'match', id: parts[1] } : { name: 'matches' };
    case 'standings':
      return { name: 'standings', nfl: parts[1] === 'nfl' };
    case 'profile':
      return { name: 'profile' };
    case 'admin':
      return { name: 'admin' };
    case 'season':
      return { name: 'season', season: num(parts[1]) };
    case 'bonus':
      return { name: 'bonus' };
    case 'recap':
      return { name: 'recap', week: num(parts[1]) };
    case 'matches':
      return { name: 'matches', week: num(parts[1]) };
    default:
      return { name: 'matches' };
  }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return parseHash(hash);
}

export function go(path: string, replace = false) {
  const url = `#/${path}`;
  if (replace) history.replaceState(null, '', url);
  else location.hash = url;
  if (replace) dispatchEvent(new HashChangeEvent('hashchange'));
}
