import { useEffect, useState } from 'react';

export type Route =
  | { name: 'matchs'; week?: number }
  | { name: 'match'; id: string }
  | { name: 'classement'; nfl?: boolean }
  | { name: 'profil' }
  | { name: 'bilan' }
  | { name: 'recap'; week?: number };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'match':
      return parts[1] ? { name: 'match', id: parts[1] } : { name: 'matchs' };
    case 'classement':
      return { name: 'classement', nfl: parts[1] === 'nfl' };
    case 'profil':
      return { name: 'profil' };
    case 'bilan':
      return { name: 'bilan' };
    case 'recap':
      return { name: 'recap', week: parts[1] ? Number(parts[1]) : undefined };
    case 'matchs':
      return { name: 'matchs', week: parts[1] ? Number(parts[1]) : undefined };
    default:
      return { name: 'matchs' };
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
