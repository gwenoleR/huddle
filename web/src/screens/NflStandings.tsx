import { type ReactNode, useState } from 'react';
import { Button } from '../ds';
import { type NflTeamRow } from '../lib/api';
import { openTeam } from '../lib/teamSheet';
import { useNflStandings } from '../lib/data';
import { Loading } from './shared';
import { t } from '../lib/i18n';

const PLAYOFF_SPOTS = 7;
const DIVISION_WINNERS = 4;

/** NFL standings: the playoff race by conference, or the 8 divisions. */
export function NflStandings({ theme, tabs }: { theme: 'dark' | 'light'; tabs: ReactNode }) {
  const q = useNflStandings();
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
      /* never mind */
    }
  }

  const logo = (row: NflTeamRow) => (theme === 'dark' ? row.team.logoDark : row.team.logo);

  return (
    <div className="screen-inner">
      <header className="head" style={{ gap: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">{t.team.nflEyebrow(d?.season ?? '')}</span>
          <h1 className="h1">{t.team.nflTitle}</h1>
        </div>
        {tabs}
        <div className="segmented">
          <Button variant={view === 'race' ? 'primary' : 'secondary'} onClick={() => choose('race')}>
            {t.team.race}
          </Button>
          <Button variant={view === 'divisions' ? 'primary' : 'secondary'} onClick={() => choose('divisions')}>
            {t.team.divisions}
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
                  {c.seeds.map((row, i) => (
                    <li key={row.teamId} className={i >= PLAYOFF_SPOTS ? 'nfl-out' : undefined}>
                      {i === PLAYOFF_SPOTS && <div className="nfl-cut">{t.team.playoffLine}</div>}
                      <button type="button" className="nfl-row" onClick={() => openTeam(row.team.abbr)}>
                        <span className="nfl-rank">{row.seed ?? i + 1}</span>
                        <img src={logo(row)} alt="" width={28} height={28} loading="lazy" />
                        <span className="nfl-name">
                          <b>{row.team.name}</b>
                          <span className="muted small">
                            {i < DIVISION_WINNERS ? t.team.divisionWinner(row.division) : i < PLAYOFF_SPOTS ? t.team.wildCard : row.division}
                            {row.clinch === 'in' ? ` · ${t.team.clinched}` : row.clinch === 'out' ? ` · ${t.team.eliminated}` : ''}
                          </span>
                        </span>
                        <span className="nfl-rec">{row.record}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <p className="muted small" style={{ margin: 0 }}>
              {t.team.raceHelp}
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
                      <span>{t.team.colRecord}</span>
                      <span>{t.team.colStreak}</span>
                      <span>{t.team.colDiff}</span>
                    </span>
                  </div>
                  <ol className="nfl-list">
                    {div.teams.map((row) => (
                      <li key={row.teamId}>
                        <button type="button" className="nfl-row" onClick={() => openTeam(row.team.abbr)}>
                          <span className="nfl-rank">{row.divRank}</span>
                          <img src={logo(row)} alt="" width={28} height={28} loading="lazy" />
                          <span className="nfl-name">
                            <b>{row.team.name}</b>
                            <span className="muted small">
                              {t.team.seed(row.seed, c.abbr, !!row.seed && row.seed <= PLAYOFF_SPOTS)}
                              {row.clinch === 'in' ? ` · ${t.team.clinched}` : row.clinch === 'out' ? ` · ${t.team.eliminated}` : ''}
                            </span>
                          </span>
                          <span className="nfl-cols">
                            <span className="nfl-rec">{row.record}</span>
                            <span>{row.streak ?? '–'}</span>
                            <span className={row.diff?.startsWith('+') ? 'nfl-plus' : row.diff?.startsWith('-') ? 'nfl-minus' : undefined}>
                              {row.diff ?? '–'}
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
              {t.team.divisionsHelp}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
