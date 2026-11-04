import { useEffect, useState } from 'react';
import { Button, LeaderboardRow } from '../ds/components';
import { api, type Me, type StandingRow, type WeeksDto } from '../lib/api';
import { plural } from '../lib/format';
import { go } from '../lib/router';
import { Loading } from './shared';

export function Leaderboard({ me }: { me: Me }) {
  const [weeks, setWeeks] = useState<WeeksDto | null>(null);
  const [scope, setScope] = useState<'season' | 'week'>('season');
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<WeeksDto>('/weeks').then(setWeeks).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!weeks) return;
    setRows(null);
    api<{ rows: StandingRow[] }>(scope === 'season' ? '/leaderboard' : `/leaderboard?week=${weeks.current}`)
      .then((d) => setRows(d.rows))
      .catch((e) => setError(e.message));
  }, [scope, weeks]);

  const currentLabel = weeks?.weeks.find((w) => w.week === weeks.current)?.longLabel ?? '';
  const mine = rows?.find((r) => r.id === me.id);
  const leader = rows?.[0];

  return (
    <div className="screen-inner">
      <header className="head" style={{ gap: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">
            Saison {weeks?.season ?? ''} · reprise en semaine {weeks?.startWeek ?? ''}
          </span>
          <h1 className="h1">Classement</h1>
        </div>
        <div className="segmented">
          <Button variant={scope === 'season' ? 'primary' : 'secondary'} onClick={() => setScope('season')}>
            Saison
          </Button>
          <Button variant={scope === 'week' ? 'primary' : 'secondary'} onClick={() => setScope('week')}>
            {currentLabel || 'Semaine'}
          </Button>
        </div>
      </header>

      <main className="stack" style={{ gap: 16 }}>
        {error && <p className="error-box card">{error}</p>}
        {!rows && !error && <Loading />}
        {mine && leader && scope === 'season' && (
          <section className="card highlight">
            <span className="big-rank">
              {mine.rank}
              <sup>{mine.rank === 1 ? 'er' : 'e'}</sup>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {mine.rank === 1 ? 'Tu mènes la danse' : mine.rank <= 3 ? 'Tu es sur le podium' : 'Accroche-toi'}
              </span>
              <span className="muted small">{gapText(rows!, mine)}</span>
            </div>
          </section>
        )}
        {rows && (
          <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <LeaderboardRow
                key={r.id}
                rank={r.rank}
                name={r.name}
                points={r.points}
                me={r.id === me.id}
                record={
                  scope === 'week'
                    ? r.played
                      ? `${r.good} bon${r.good > 1 ? 's' : ''} sur ${r.played}`
                      : 'Pas encore de match terminé'
                    : r.played
                      ? `${r.good} / ${r.played} depuis la S${weeks?.startWeek} · ${r.startPoints} repris`
                      : `${r.startPoints} pts repris de l’ancien site`
                }
              />
            ))}
          </ol>
        )}
        <Button variant="secondary" block onClick={() => go('bilan')}>
          Bilan de saison
        </Button>
      </main>
    </div>
  );
}

function gapText(rows: StandingRow[], mine: StandingRow) {
  if (mine.rank === 1) {
    const second = rows.find((r) => r.id !== mine.id);
    if (!second) return 'Seul en piste';
    const gap = mine.points - second.points;
    return gap === 0 ? `À égalité avec ${second.name}` : `${plural(gap, 'pt')} d’avance sur ${second.name}`;
  }
  const leader = rows[0];
  const gap = leader.points - mine.points;
  const below = rows.find((r) => r.points < mine.points);
  const behind = below ? ` · ${plural(mine.points - below.points, 'pt')} devant ${below.name}` : '';
  return `À ${plural(gap, 'pt')} de ${leader.name}${behind}`;
}
