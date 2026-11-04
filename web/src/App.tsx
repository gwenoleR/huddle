import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav } from './ds/components';
import { api, type Me } from './lib/api';
import { go, useRoute } from './lib/router';
import { useTheme } from './lib/theme';
import { Leaderboard } from './screens/Leaderboard';
import { Login } from './screens/Login';
import { MatchDetail } from './screens/MatchDetail';
import { Matches } from './screens/Matches';
import { Profile } from './screens/Profile';
import { Season } from './screens/Season';
import { Recap } from './screens/Recap';

export function App() {
  const { pref, setPref, theme } = useTheme();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const route = useRoute();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    api<Me>('/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    if ('caches' in window) await caches.delete('api').catch(() => {});
    setMe(null);
    go('matchs', true);
  }

  if (me === undefined) return <div className="app splash" />;
  if (me === null) return <Login onLogged={setMe} />;

  const tab =
    route.name === 'match' || route.name === 'matchs' ? 'matchs' : route.name === 'bilan' || route.name === 'recap' ? 'classement' : route.name;
  const screenKey = route.name === 'match' ? `match-${route.id}` : route.name;

  return (
    <div className="app">
      <div className="screen" key={screenKey}>
        {route.name === 'matchs' && <Matches routeWeek={route.week} me={me} theme={theme} notify={notify} />}
        {route.name === 'match' && <MatchDetail id={route.id} me={me} theme={theme} notify={notify} />}
        {route.name === 'classement' && <Leaderboard me={me} />}
        {route.name === 'bilan' && <Season me={me} />}
        {route.name === 'recap' && <Recap week={route.week} notify={notify} />}
        {route.name === 'profil' && <Profile themePref={pref} setThemePref={setPref} onLogout={logout} notify={notify} />}
      </div>
      <BottomNav active={tab} onChange={(id) => go(id)} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
