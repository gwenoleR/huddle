import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav } from './ds';
import { api, SESSION_LOST, type Me } from './lib/api';
import { go, useRoute } from './lib/router';
import { claimCache, forgetEverything } from './lib/queries';
import { useTheme } from './lib/theme';
import { t } from './lib/i18n';
import { Leaderboard } from './screens/Leaderboard';
import { TeamSheet } from './screens/TeamSheet';
import { Admin } from './screens/Admin';
import { Bonus } from './screens/Bonus';
import { Login } from './screens/Login';
import { MatchDetail } from './screens/MatchDetail';
import { Matches } from './screens/Matches';
import { Profile } from './screens/Profile';
import { Season } from './screens/Season';
import { Recap } from './screens/Recap';
import { UpdatePrompt } from './screens/UpdatePrompt';

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
      .then((m) => {
        claimCache(m.id);
        setMe(m);
      })
      .catch(() => setMe(null));
  }, []);

  // Session lost along the way (code reset by the admin, session expired): back to login.
  useEffect(() => {
    const onLost = () => {
      forgetEverything();
      setMe(null);
      notify(t.app.sessionExpired);
    };
    addEventListener(SESSION_LOST, onLost);
    return () => removeEventListener(SESSION_LOST, onLost);
  }, [notify]);

  async function logout() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    if ('caches' in window) await caches.delete('api').catch(() => {});
    forgetEverything();
    setMe(null);
    go('matches', true);
  }

  if (me === undefined) return <div className="app splash" />;
  const toastBox = toast && (
    <div className="toast" role="status">
      {toast}
    </div>
  );

  if (me === null)
    return (
      <>
        <Login
          onLogged={(m) => {
            claimCache(m.id);
            setMe(m);
          }}
        />
        <UpdatePrompt />
        {toastBox}
      </>
    );

  const tab =
    route.name === 'match' || route.name === 'matches' ? 'matches' : route.name === 'season' || route.name === 'recap' || route.name === 'bonus' ? 'standings' : route.name === 'admin' ? 'profile' : route.name;
  const screenKey = route.name === 'match' ? `match-${route.id}` : route.name === 'standings' && route.nfl ? 'standings-nfl' : route.name;

  return (
    <div className="app">
      <div className="screen" key={screenKey}>
        {route.name === 'matches' && <Matches routeWeek={route.week} me={me} theme={theme} notify={notify} />}
        {route.name === 'match' && <MatchDetail id={route.id} me={me} theme={theme} notify={notify} />}
        {route.name === 'standings' && <Leaderboard me={me} nfl={!!route.nfl} theme={theme} />}
        {route.name === 'season' && <Season me={me} season={route.season} />}
        {route.name === 'bonus' && <Bonus me={me} theme={theme} notify={notify} />}
        {route.name === 'recap' && <Recap week={route.week} notify={notify} />}
        {route.name === 'admin' && <Admin me={me} notify={notify} />}
        {route.name === 'profile' && <Profile themePref={pref} setThemePref={setPref} onLogout={logout} notify={notify} />}
      </div>
      <BottomNav active={tab} onChange={(id) => go(id)} />
      <TeamSheet me={me} theme={theme} />
      <UpdatePrompt />
      {toastBox}
    </div>
  );
}
