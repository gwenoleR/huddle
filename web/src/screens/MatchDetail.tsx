import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, MatchCard, type Side } from '../ds/components';
import { api, type GameDetailDto, type Me } from '../lib/api';
import { kickoffLabel } from '../lib/format';
import { applyPick, keys } from '../lib/queries';
import { MatchLive } from './MatchLive';
import { MatchPreview } from './MatchPreview';
import { BackLink, cardStatus, Loading, toTeam } from './shared';

export function MatchDetail({ id, me, theme, notify }: { id: string; me: Me; theme: 'dark' | 'light'; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.game(id), queryFn: () => api<GameDetailDto>(`/games/${id}`), refetchInterval: 60_000 });
  const g = q.data;
  const error = q.error?.message ?? null;

  async function pick(side: Side) {
    if (!g || g.myPick === side) return;
    const key = keys.game(id);
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<GameDetailDto>(key);
    qc.setQueryData<GameDetailDto>(key, (d) => d && { ...applyPick(d, side, me.name), waiting: d.waiting.filter((n) => n !== me.name) });
    try {
      await api(`/picks/${id}`, { method: 'PUT', body: { side } });
    } catch (e) {
      qc.setQueryData(key, previous);
      notify((e as Error).message);
    }
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: keys.week(g.week) });
  }

  if (!g) return error ? <p className="error-box">{error}</p> : <Loading />;
  const { status, statusText } = cardStatus(g);
  const label = (n: string) => (n === me.name ? 'Toi' : n);

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 4px', display: 'flex', alignItems: 'center' }}>
        <BackLink href={`#/matchs/${g.week}`} label={g.weekLabel} />
      </header>
      <main className="stack" style={{ gap: 16 }}>
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
          onPick={g.locked ? undefined : pick}
        />

        {(g.status === 'scheduled' || g.status === 'postponed') && <MatchPreview game={g} />}
        {(g.status === 'live' || g.status === 'final') && <MatchLive game={g} />}

        {g.counted && (
          <>
            <section className="grid-2">
              {(['away', 'home'] as const).map((side) => (
                <div key={side} className="card people">
                  <h2>
                    {g[side].name}
                    <span style={{ color: side === 'away' ? 'var(--side-a)' : 'var(--side-b)', fontVariantNumeric: 'tabular-nums' }}>
                      {g.pickers[side].length}
                    </span>
                  </h2>
                  {g.pickers[side].length === 0 && <span className="muted small">Personne</span>}
                  {g.pickers[side].map((n) => (
                    <div key={n} className="person">
                      <Avatar name={n} size="sm" side={side === 'away' ? 'a' : 'b'} me={n === me.name} />
                      <span>{label(n)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="section-title" style={{ margin: 0 }}>
                Pas encore joué
              </span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                {g.waiting.length ? g.waiting.map(label).join(', ') : 'Personne. Toute la bande a choisi son camp.'}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
