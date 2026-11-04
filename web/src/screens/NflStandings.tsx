import { type ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ds';
import { api, type NflStandingsDto, type NflTeamRow } from '../lib/api';
import { openTeam } from '../lib/teamSheet';
import { keys } from '../lib/queries';
import { Loading } from './shared';

const PLAYOFF_SPOTS = 7;
const DIVISION_WINNERS = 4;

/** Classement NFL : la course aux playoffs par conférence, ou les 8 divisions. */
export function NflStandings({ theme, tabs }: { theme: 'dark' | 'light'; tabs: ReactNode }) {
  const q = useQuery({ queryKey: keys.nflStandings, queryFn: () => api<NflStandingsDto>('/nfl/standings'), staleTime: 30 * 60_000 });
  const d = q.data;
  const error = d ? null : q.error?.message ?? null;
  const [view, setView] = useState<'race' | 'divisions'>(() => {
    try {
      return localStorage.getItem('nfl-view') === 'divisions' ? 'divisions' : 'race';
    } catch {
      return 'race';
    }
  });

  function choose(v: 'race' | 'divisions') {
    setView(v);
    try {
      localStorage.setItem('nfl-view', v);
    } catch {
      /* pas grave */
    }
  }

  const logo = (t: NflTeamRow) => (theme === 'dark' ? t.team.logoDark : t.team.logo);

  return (
    <div className="screen-inner">
      <header className="head" style={{ gap: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">Saison {d?.season ?? ''} · NFL</span>
          <h1 className="h1">Classement</h1>
        </div>
        {tabs}
        <div className="segmented">
          <Button variant={view === 'race' ? 'primary' : 'secondary'} onClick={() => choose('race')}>
            Course aux playoffs
          </Button>
          <Button variant={view === 'divisions' ? 'primary' : 'secondary'} onClick={() => choose('divisions')}>
            Divisions
          </Button>
        </div>
      </header>

      <main className="stack" style={{ gap: 16 }}>
        {error && <p className="error-box card">{error}</p>}
        {!d && !error && <Loading />}

        {d && view === 'race' && (
          <>
            {d.conferences.map((c) => (
              <section key={c.abbr} className="card nfl-card">
                <h2 className="nfl-title">{c.abbr}</h2>
                <ol className="nfl-list">
                  {c.seeds.map((t, i) => (
                    <li key={t.teamId} className={i >= PLAYOFF_SPOTS ? 'nfl-out' : undefined}>
                      {i === PLAYOFF_SPOTS && <div className="nfl-cut">Ligne des playoffs</div>}
                      <button type="button" className="nfl-row" onClick={() => openTeam(t.team.abbr)}>
                        <span className="nfl-rank">{t.seed ?? i + 1}</span>
                        <img src={logo(t)} alt="" width={28} height={28} loading="lazy" />
                        <span className="nfl-name">
                          <b>{t.team.name}</b>
                          <span className="muted small">
                            {i < DIVISION_WINNERS ? `1er ${t.division}` : i < PLAYOFF_SPOTS ? 'Wild card' : t.division}
                            {t.clinch === 'in' ? ' · qualifié' : t.clinch === 'out' ? ' · éliminé' : ''}
                          </span>
                        </span>
                        <span className="nfl-rec">{t.record}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <p className="muted small" style={{ margin: 0 }}>
              Par conférence, 7 équipes vont en playoffs : les 4 vainqueurs de division (têtes de série 1 à 4) et les 3 meilleures
              autres (wild cards). La tête de série 1 est exemptée du premier tour.
            </p>
          </>
        )}

        {d && view === 'divisions' && (
          <>
            {d.conferences.flatMap((c) =>
              c.divisions.map((div) => (
                <section key={div.name} className="card nfl-card">
                  <div className="nfl-div-head">
                    <h2 className="nfl-title">{div.name}</h2>
                    <span className="muted small nfl-cols">
                      <span>Bilan</span>
                      <span>Série</span>
                      <span>Diff.</span>
                    </span>
                  </div>
                  <ol className="nfl-list">
                    {div.teams.map((t) => (
                      <li key={t.teamId}>
                        <button type="button" className="nfl-row" onClick={() => openTeam(t.team.abbr)}>
                          <span className="nfl-rank">{t.divRank}</span>
                          <img src={logo(t)} alt="" width={28} height={28} loading="lazy" />
                          <span className="nfl-name">
                            <b>{t.team.name}</b>
                            <span className="muted small">
                              {t.seed && t.seed <= PLAYOFF_SPOTS ? `Tête de série ${t.seed}` : `${t.seed ?? '–'}e ${c.abbr}`}
                              {t.clinch === 'in' ? ' · qualifié' : t.clinch === 'out' ? ' · éliminé' : ''}
                            </span>
                          </span>
                          <span className="nfl-cols">
                            <span className="nfl-rec">{t.record}</span>
                            <span>{t.streak ?? '–'}</span>
                            <span className={t.diff?.startsWith('+') ? 'nfl-plus' : t.diff?.startsWith('-') ? 'nfl-minus' : undefined}>
                              {t.diff ?? '–'}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}
            <p className="muted small" style={{ margin: 0 }}>
              Série : victoires (V) ou défaites (D) d’affilée. Diff. : points marqués moins points encaissés.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
