import { useEffect, useRef, useState } from 'react';
import { Button } from '../ds';
import { type Me, type TeamSheetDto } from '../lib/api';
import { dayLabel } from '../lib/format';
import { standingText, withByes } from '../lib/labels';
import { useTeam } from '../lib/data';
import { t } from '../lib/i18n';

/** Team page as a sheet: closing it brings back the screen (and its pick) as it was. */
export function TeamSheet({ me, theme }: { me: Me; theme: 'dark' | 'light' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [abbr, setAbbr] = useState<string | null>(null);
  const q = useTeam(abbr);
  const d = abbr ? q.data ?? null : null;
  const error = d ? null : q.error?.message ?? null;

  useEffect(() => {
    const onOpen = (e: Event) => setAbbr((e as CustomEvent<string>).detail);
    const onNav = () => setAbbr(null);
    addEventListener('open-team', onOpen);
    addEventListener('hashchange', onNav);
    return () => {
      removeEventListener('open-team', onOpen);
      removeEventListener('hashchange', onNav);
    };
  }, []);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (abbr && !dlg.open) dlg.showModal();
    if (!abbr && dlg.open) dlg.close();
  }, [abbr]);

  const close = () => setAbbr(null);
  const logo = (team: TeamSheetDto['team']) => (theme === 'dark' ? team.logoDark : team.logo);
  const played = d?.band.filter((b) => b.with + b.against > 0) ?? [];

  return (
    <dialog
      ref={ref}
      className="sheet sheet-scroll"
      aria-labelledby="team-title"
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="sheet-body team-sheet">
        {error && <p className="error-box">{error}</p>}
        {!d && !error && <p className="muted">{t.ds.loading}</p>}
        {d && (
          <>
            <header className="team-head">
              <img src={logo(d.team)} alt="" width={64} height={64} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <h2 id="team-title" className="h1" style={{ margin: 0 }}>
                  {d.team.fullName}
                </h2>
                <span className="muted small">
                  {d.record} · {standingText(d.standing)}
                </span>
              </div>
            </header>

            <section className="team-section">
              <span className="section-title" style={{ margin: 0 }}>
                {t.team.bandTitle(d.team.name)}
              </span>
              {played.length === 0 && (
                <span className="muted small">{t.team.noBandPicks}</span>
              )}
              {played.map((b) => (
                <div key={b.name} className="team-band">
                  <b>{b.name === me.name ? t.match.you : b.name}</b>
                  <span className="small">
                    {b.with > 0 && (
                      <span>
                        {t.team.withThem(b.with)} · <span className="team-good">{t.team.good(b.withGood)}</span>
                      </span>
                    )}
                    {b.with > 0 && b.against > 0 && <span className="muted"> · </span>}
                    {b.against > 0 && (
                      <span>
                        {t.team.against(b.against)} · <span className="team-good">{t.team.good(b.againstGood)}</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </section>

            <section className="team-section">
              <span className="section-title" style={{ margin: 0 }}>
                {t.team.schedule}
              </span>
              <ol className="team-schedule">
                {withByes(d.schedule).map((g) =>
                  'bye' in g ? (
                    <li key={`bye-${g.week}`}>
                      <span className="team-game muted">
                        <span className="team-week">{t.common.weekLabel(g.week)}</span>
                        <span className="small">{t.team.bye}</span>
                      </span>
                    </li>
                  ) : (
                  <li key={g.id}>
                    <a href={`#/match/${g.id}`} className="team-game" onClick={close}>
                      <span className="team-week">{g.weekLabel}</span>
                      <span className="muted small team-at">{g.home ? t.team.vs : t.team.at}</span>
                      <img src={logo(g.opponent)} alt="" width={22} height={22} loading="lazy" />
                      <span className="team-opp">{g.opponent.name}</span>
                      {g.result ? (
                        <span className="team-res">
                          <span className={`preview-chip preview-chip-${g.result} team-chip`}>{t.match.resultLetter[g.result]}</span>
                          {g.score}
                        </span>
                      ) : g.status === 'live' ? (
                        <span className="team-res team-live">{t.team.live(g.score)}</span>
                      ) : (
                        <span className="muted small team-res">{g.status === 'postponed' ? t.matches.postponed : dayLabel(g.kickoff)}</span>
                      )}
                    </a>
                  </li>
                  )
                )}
              </ol>
            </section>
          </>
        )}
        <Button block onClick={close}>
          {t.team.close}
        </Button>
      </div>
    </dialog>
  );
}
