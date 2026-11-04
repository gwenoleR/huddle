import { useEffect, useState } from 'react';
import { Avatar, LeaderboardRow } from '../ds/components';
import { api, type Me, type SeasonDto } from '../lib/api';
import { BackLink, Loading } from './shared';

export function Season({ me }: { me: Me }) {
  const [s, setS] = useState<SeasonDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<SeasonDto>('/season').then(setS).catch((e) => setError(e.message));
  }, []);

  if (!s) return error ? <p className="error-box">{error}</p> : <Loading />;
  const leader = s.rows[0];

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
          {s.awards.length === 0 && (
            <div className="card card-pad muted small">Les trophées arrivent après les premiers matchs joués dans l’appli.</div>
          )}
          {s.awards.map((a) => (
            <div key={a.title} className="card award">
              <Avatar name={a.who} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{a.title}</span>
                <span className="muted small">
                  {a.who} · {a.detail}
                </span>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
