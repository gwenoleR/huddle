import { Fragment, useEffect, useRef } from 'react';
import { MatchCard, WeekPicker } from '../ds';
import type { Me } from '../lib/api';
import { useBonus, usePick, useWeek, useWeeks } from '../lib/data';
import { dayLabel, kickoffLabel, plural } from '../lib/format';
import { go } from '../lib/router';
import { detailLabel } from '../lib/labels';
import { useScrollMemory } from '../lib/scrollMemory';
import { cardStatus, Loading, toTeam } from './shared';

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
  const weeksQ = useWeeks();
  const weeks = weeksQ.data;
  const week = routeWeek ?? weeks?.current;
  const weekQ = useWeek(week);
  const data = weekQ.data;

  // Au retour d'une fiche match, la liste reprend là où on l'avait laissée (une position par semaine).
  const root = useRef<HTMLDivElement>(null);
  useScrollMemory(root, data ? `matchs-${data.week}` : null, !!weeks && !!data);
  const error = (weekQ.error ?? weeksQ.error)?.message ?? null;

  // Centre la semaine affichée dans la barre (une fois les données là, sinon la barre n'existe pas encore).
  const shownWeek = data?.week;
  useEffect(() => {
    if (!shownWeek) return;
    const chip = document.querySelector<HTMLElement>(`.pr-week[data-week="${shownWeek}"]`);
    const bar = chip?.parentElement;
    if (chip && bar) bar.scrollLeft = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
  }, [shownWeek]);

  const pick = usePick(me, notify);

  if (!weeks || !data) return error ? <p className="error-box">{error}</p> : <Loading />;

  const counted = data.week >= weeks.startWeek;
  const open = data.games.filter((g) => !g.locked);
  const todo = open.filter((g) => !g.myPick);
  const done = data.games.filter((g) => g.myPick).length;
  const nextKick = todo.length ? Math.min(...todo.map((g) => g.kickoff)) : null;
  const playoffs = data.week >= 19;

  let lastDay = '';

  return (
    <div className="screen-inner" ref={root}>
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
        <BonusBanner playoffs={playoffs} />
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

/** Carte du bonus de fin de saison : visible quand les choix sont ouverts, puis pendant les playoffs. */
function BonusBanner({ playoffs }: { playoffs: boolean }) {
  const { data: b } = useBonus();
  if (!b || !(b.phase === 'open' || (b.phase === 'locked' && playoffs))) return null;
  const max = b.points.afc + b.points.nfc + b.points.sb;
  return (
    <a href="#/bonus" className="card bonus-card">
      <span className="bonus-card-text">
        <b>Bonus de fin de saison</b>
        <span className="muted small">
          {b.phase === 'open'
            ? b.mine
              ? `Tes choix sont faits · modifiables jusqu’au ${dayLabel(b.lockAt!)}`
              : `Jusqu’à ${max} pts à gagner · à choisir avant le ${dayLabel(b.lockAt!)}`
            : b.revealed
              ? 'Les choix de la bande sont révélés'
              : 'Choix verrouillés · révélés au coup d’envoi du Super Bowl'}
        </span>
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </a>
  );
}
