import { Avatar, MatchCard, type Side } from '../ds';
import type { Me } from '../lib/api';
import { useGame, usePick } from '../lib/data';
import { kickoffLabel } from '../lib/format';
import { MatchLive } from './MatchLive';
import { MatchPreview } from './MatchPreview';
import { BackLink, cardStatus, Loading, toTeam } from './shared';
import { t } from '../lib/i18n';

export function MatchDetail({ id, me, theme, notify }: { id: string; me: Me; theme: 'dark' | 'light'; notify: (m: string) => void }) {
  const q = useGame(id);
  const g = q.data;
  const error = q.error?.message ?? null;
  const pickGame = usePick(me, notify);
  const pick = (side: Side) => g && pickGame(g, side);

  if (!g) return error ? <p className="error-box">{error}</p> : <Loading />;
  const { status, statusText } = cardStatus(g);
  const label = (n: string) => (n === me.name ? t.match.you : n);

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 4px', display: 'flex', alignItems: 'center' }}>
        <BackLink href={`#/matches/${g.week}`} label={g.weekLabel} />
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
                  {g.pickers[side].length === 0 && <span className="muted small">{t.match.nobody}</span>}
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
                {t.match.notPlayedYet}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                {g.waiting.length ? g.waiting.map(label).join(', ') : t.match.everyonePicked}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
