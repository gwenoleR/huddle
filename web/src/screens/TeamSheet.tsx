import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ds';
import { api, type Me, type TeamSheetDto } from '../lib/api';
import { dayLabel } from '../lib/format';
import { standingText, withByes } from '../lib/labels';
import { keys } from '../lib/queries';

/** Fiche équipe en feuille : on la ferme et on retrouve l'écran (et son prono) tel quel. */
export function TeamSheet({ me, theme }: { me: Me; theme: 'dark' | 'light' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [abbr, setAbbr] = useState<string | null>(null);
  const q = useQuery({ queryKey: keys.team(abbr ?? ''), queryFn: () => api<TeamSheetDto>(`/teams/${abbr}`), enabled: !!abbr });
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
  const logo = (t: TeamSheetDto['team']) => (theme === 'dark' ? t.logoDark : t.logo);
  const played = d?.bande.filter((b) => b.with + b.against > 0) ?? [];

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
        {!d && !error && <p className="muted">Chargement…</p>}
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
                La bande et les {d.team.name}
              </span>
              {played.length === 0 && (
                <span className="muted small">Personne n’a encore eu de prono terminé sur un de leurs matchs depuis la reprise.</span>
              )}
              {played.map((b) => (
                <div key={b.name} className="team-bande">
                  <b>{b.name === me.name ? 'Toi' : b.name}</b>
                  <span className="small">
                    {b.with > 0 && (
                      <span>
                        Avec eux {b.with}× · <span className="team-good">{b.withGood} bon{b.withGood > 1 ? 's' : ''}</span>
                      </span>
                    )}
                    {b.with > 0 && b.against > 0 && <span className="muted"> · </span>}
                    {b.against > 0 && (
                      <span>
                        Contre {b.against}× · <span className="team-good">{b.againstGood} bon{b.againstGood > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </section>

            <section className="team-section">
              <span className="section-title" style={{ margin: 0 }}>
                Calendrier
              </span>
              <ol className="team-schedule">
                {withByes(d.schedule).map((g) =>
                  'bye' in g ? (
                    <li key={`bye-${g.week}`}>
                      <span className="team-game muted">
                        <span className="team-week">S{g.week}</span>
                        <span className="small">Semaine de repos</span>
                      </span>
                    </li>
                  ) : (
                  <li key={g.id}>
                    <a href={`#/match/${g.id}`} className="team-game" onClick={close}>
                      <span className="team-week">{g.weekLabel}</span>
                      <span className="muted small team-at">{g.home ? 'vs' : '@'}</span>
                      <img src={logo(g.opponent)} alt="" width={22} height={22} loading="lazy" />
                      <span className="team-opp">{g.opponent.name}</span>
                      {g.result ? (
                        <span className="team-res">
                          <span className={`preview-chip preview-chip-${g.result} team-chip`}>{g.result}</span>
                          {g.score}
                        </span>
                      ) : g.status === 'live' ? (
                        <span className="team-res team-live">En direct {g.score}</span>
                      ) : (
                        <span className="muted small team-res">{g.status === 'postponed' ? 'Reporté' : dayLabel(g.kickoff)}</span>
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
          Fermer
        </Button>
      </div>
    </dialog>
  );
}
