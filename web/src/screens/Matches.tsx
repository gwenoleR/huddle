import { Fragment, useCallback, useEffect, useState } from 'react';
import { MatchCard, WeekPicker, type Side } from '../ds/components';
import { api, type GameDto, type Me, type WeeksDto } from '../lib/api';
import { dayLabel, kickoffLabel, plural } from '../lib/format';
import { go } from '../lib/router';
import { cardStatus, Loading, toTeam } from './shared';

interface WeekData {
  week: number;
  label: string;
  points: number;
  games: GameDto[];
}

export function Matches({
  routeWeek,
  me,
  theme,
  notify
}: {
  routeWeek?: number;
  me: Me;
  theme: 'dark' | 'light';
  notify: (msg: string) => void;
}) {
  const [weeks, setWeeks] = useState<WeeksDto | null>(null);
  const [data, setData] = useState<WeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const week = routeWeek ?? weeks?.current;

  useEffect(() => {
    api<WeeksDto>('/weeks')
      .then(setWeeks)
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!week) return;
    try {
      setData(await api<WeekData>(`/weeks/${week}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [week]);

  useEffect(() => {
    setData((d) => (d?.week === week ? d : null));
    void load();
  }, [load, week]);

  // Rafraîchissement : 30 s pendant les matchs, 5 min sinon, et au retour dans l'appli.
  useEffect(() => {
    const now = Date.now();
    const hot = data?.games.some(
      (g) => g.status === 'live' || (g.status === 'scheduled' && g.kickoff - now < 15 * 60_000 && g.kickoff > now - 6 * 3600_000)
    );
    const id = setInterval(load, hot ? 30_000 : 5 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, load]);

  // Centre la semaine affichée dans la barre (une fois les données là, sinon la barre n'existe pas encore).
  const shownWeek = data?.week;
  useEffect(() => {
    if (!shownWeek) return;
    const chip = document.querySelector<HTMLElement>(`.pr-week[data-week="${shownWeek}"]`);
    const bar = chip?.parentElement;
    if (chip && bar) bar.scrollLeft = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
  }, [shownWeek]);

  async function pick(game: GameDto, side: Side) {
    if (game.myPick === side) return;
    const previous = data;
    // Mise à jour immédiate, corrigée si le serveur refuse.
    setData((d) =>
      d && {
        ...d,
        games: d.games.map((g) => {
          if (g.id !== game.id) return g;
          const away = g.pickers.away.filter((n) => n !== me.name);
          const home = g.pickers.home.filter((n) => n !== me.name);
          (side === 'away' ? away : home).unshift(me.name);
          return { ...g, myPick: side, pickers: { away, home } };
        })
      }
    );
    try {
      await api(`/picks/${game.id}`, { method: 'PUT', body: { side } });
    } catch (e) {
      setData(previous);
      notify((e as Error).message);
      void load();
    }
  }

  if (!weeks || !data) return error ? <p className="error-box">{error}</p> : <Loading />;

  const counted = data.week >= weeks.startWeek;
  const open = data.games.filter((g) => !g.locked);
  const todo = open.filter((g) => !g.myPick);
  const done = data.games.filter((g) => g.myPick).length;
  const nextKick = todo.length ? Math.min(...todo.map((g) => g.kickoff)) : null;
  const playoffs = data.week >= 19;

  let lastDay = '';

  return (
    <div className="screen-inner">
      <header className="head">
        <span className="eyebrow">
          Saison {weeks.season} · {playoffs ? 'Playoffs' : 'Saison régulière'}
        </span>
        <div className="head-row">
          <h1 className="h1">{data.label}</h1>
          {counted && data.games.length > 0 && (
            <span className="counter">
              {done} / {data.games.length} <small>pronos</small>
            </span>
          )}
        </div>
        {playoffs && <span className="chip-2pts">2 pts par bon prono</span>}
        {todo.length > 0 && nextKick && (
          <p className="urgent">
            Il t’en reste {todo.length} · prochain coup d’envoi {kickoffLabel(nextKick)}
          </p>
        )}
      </header>

      <div className="sticky-weeks">
        <WeekPicker
          weeks={weeks.weeks.map((w) => ({ id: w.week, label: w.label }))}
          value={data.week}
          onChange={(w) => go(`matchs/${w}`, true)}
        />
      </div>

      <main className="stack">
        {!counted && (
          <div className="card card-pad small muted">
            Les pronos comptent à partir de la semaine {weeks.startWeek}. Ici, juste les scores.
          </div>
        )}
        {data.games.length === 0 && <p className="empty">Pas encore de match annoncé pour cette semaine.</p>}
        {data.games.map((g) => {
          const day = dayLabel(g.kickoff);
          const showDay = day !== lastDay;
          lastDay = day;
          const { status, statusText } = cardStatus(g);
          return (
            <Fragment key={g.id}>
              {showDay && <h2 className="section-title">{day}</h2>}
              <MatchCard
                away={toTeam(g.away, theme)}
                home={toTeam(g.home, theme)}
                kickoff={kickoffLabel(g.kickoff)}
                status={status}
                statusText={statusText}
                myPick={g.myPick}
                score={g.score}
                awayPickers={g.pickers.away}
                homePickers={g.pickers.home}
                onPick={g.locked ? undefined : (side) => pick(g, side)}
                emptyText={counted ? undefined : 'Avant l’appli'}
                footer={
                  <a className="detail-link" href={`#/match/${g.id}`}>
                    {detailLabel(g.status, counted)}
                  </a>
                }
              />
            </Fragment>
          );
        })}
        {counted && open.length > 0 && todo.length === 0 && <p className="empty">Tous tes pronos sont faits. Plus qu’à attendre !</p>}
        {data.games.length > 0 && <p className="muted small">{plural(data.games.length, 'match')} cette semaine · heures de Paris</p>}
      </main>
    </div>
  );
}

function detailLabel(status: GameDto['status'], counted: boolean): string {
  const pronos = counted ? ' et pronos' : '';
  if (status === 'final') return `Stats du match${pronos}`;
  if (status === 'live') return `Suivre le match${pronos}`;
  return counted ? 'Favori, forme, blessés et pronos' : 'Favori, forme et blessés';
}
