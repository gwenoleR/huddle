import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, dismissUpdate, dismissedUpdate, needsUpdate, serverVersion } from './version';

const EVERY = 30 * 60_000;

/**
 * Compare la version de l'appli à celle du serveur : à l'ouverture, au retour dans l'appli
 * (une appli installée est souvent reprise plutôt que relancée) et toutes les 30 min.
 * Renvoie la version à proposer, ou null.
 */
export function useUpdateCheck(client = APP_VERSION) {
  const [available, setAvailable] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const server = await serverVersion();
      if (alive) setAvailable(needsUpdate(server, client, dismissedUpdate()) ? server : null);
    };
    void check();
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(check, EVERY);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [client]);

  const later = useCallback(() => {
    if (available) dismissUpdate(available);
    setAvailable(null);
  }, [available]);

  return { available, later };
}
