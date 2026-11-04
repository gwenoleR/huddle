import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, Icon, LeaderboardRow } from '../ds/components';
import { api, type AwardDto, type Me, type SeasonDto } from '../lib/api';
import { BackLink, Loading } from './shared';
import { keys } from '../lib/queries';

export function Season({ me }: { me: Me }) {
  const q = useQuery({ queryKey: keys.season, queryFn: () => api<SeasonDto>('/season') });
  const s = q.data;
  const error = q.error?.message ?? null;
  const [open, setOpen] = useState<AwardDto | null>(null);

  if (!s) return error ? <p className="error-box">{error}</p> : <Loading />;
  const leader = s.rows[0];
  const won = s.awards.filter((a) => a.who);
  const toWin = s.awards.filter((a) => !a.who);

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/classement" label="Classement" />
      </header>
      <main className="stack" style={{ gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">
            Saison {s.season} {s.finished ? 'terminée' : 'en cours'} · {s.finalGames} matchs joués dans l’appli
          </span>
          <h1 className="h1">Bilan de saison</h1>
        </div>

        {leader && (
          <section className="champion">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {s.finished ? 'Titre de la saison' : 'En tête pour l’instant'}
              </span>
              <span className="who">{leader.name}</span>
            </div>
            <span className="pts">
              {leader.points}
              <small> pts</small>
            </span>
          </section>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {s.finished ? 'Classement final' : 'Classement actuel'}
          </h2>
          <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.rows.map((r) => (
              <LeaderboardRow
                key={r.id}
                rank={r.rank}
                name={r.name}
                points={r.points}
                me={r.id === me.id}
                record={`${r.startPoints} repris + ${r.points - r.startPoints} dans l’appli`}
              />
            ))}
          </ol>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Les trophées de la bande
          </h2>
          {won.length === 0 && (
            <div className="card card-pad muted small">Les trophées arrivent après les premiers matchs joués dans l’appli.</div>
          )}
          {won.map((a) => (
            <AwardRow key={a.id} award={a} onOpen={() => setOpen(a)} />
          ))}
        </section>

        {toWin.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Encore à gagner
            </h2>
            {toWin.map((a) => (
              <AwardRow key={a.id} award={a} onOpen={() => setOpen(a)} />
            ))}
          </section>
        )}
      </main>
      <TrophyDialog award={open} me={me} onClose={() => setOpen(null)} />
    </div>
  );
}

function TrophyBadge({ won, size = 40 }: { won: boolean; size?: number }) {
  return (
    <span className={`trophy-badge${won ? ' trophy-won' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <Icon name="classement" size={Math.round(size * 0.55)} />
    </span>
  );
}

function AwardRow({ award, onOpen }: { award: AwardDto; onOpen: () => void }) {
  const won = !!award.who;
  return (
    <button type="button" className="card award award-btn" onClick={onOpen} aria-haspopup="dialog">
      {won ? <Avatar name={award.who!} /> : <TrophyBadge won={false} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{award.title}</span>
        <span className="muted small">{won ? `${award.who} · ${award.detail}` : 'Personne pour l’instant'}</span>
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--ink-muted)', flex: 'none' }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** Fenêtre d'explication d'un trophée (feuille qui monte du bas, fermeture par le bouton, le fond ou Échap). */
function TrophyDialog({ award, me, onClose }: { award: AwardDto | null; me: Me; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (award && !d.open) d.showModal();
    if (!award && d.open) d.close();
  }, [award]);

  const won = !!award?.who;
  const mine = award?.who === me.name;
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="trophy-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {award && (
        <div className="sheet-body">
          <TrophyBadge won={won} size={64} />
          <h2 id="trophy-title" className="h1" style={{ textAlign: 'center' }}>
            {award.title}
          </h2>
          {won ? (
            <div className="sheet-holder">
              <Avatar name={award.who!} me={mine} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{mine ? 'C’est toi !' : award.who}</span>
                <span className="muted small">{award.detail}</span>
              </span>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 15 }}>
              Personne ne le mérite encore. La place est libre.
            </p>
          )}
          <div className="sheet-rule">
            <span className="section-title" style={{ margin: 0 }}>
              Comment on le gagne
            </span>
            <p style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>{award.rule}</p>
            <p className="muted small" style={{ margin: 0 }}>
              Seuls les matchs terminés depuis la reprise comptent. Le trophée peut changer de main à tout moment.
            </p>
          </div>
          <Button block onClick={onClose}>
            Compris
          </Button>
        </div>
      )}
    </dialog>
  );
}
