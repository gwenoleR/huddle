import { type GameDto, type LiveDto } from '../lib/api';
import { TeamLink } from './shared';
import { useLive } from '../lib/data';
import { t } from '../lib/i18n';

/** Pendant et après le match : situation en cours, courbe des chances de victoire et actions qui ont marqué. */
export function MatchLive({ game }: { game: GameDto }) {
  const live = game.status === 'live';
  // Pendant le match : toutes les 30 s (en pause quand l'appli est en arrière-plan).
  const q = useLive(game.id, live);
  const d = q.data;
  const error = q.error?.message ?? null;

  if (!d) return error ? <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>{error}</p> : null;
  const team = (s: 'away' | 'home' | null) => (s ? game[s] : null);
  const sit = d.situation;
  const now = d.winProb.at(-1);

  return (
    <>
      {live && sit && (sit.possession || sit.lastPlay) && (
        <section className="card card-pad live-sit">
          {sit.possession && (
            <div className="live-ball">
              <span className={`live-dot ${sit.possession === 'away' ? 'pr-split-a' : 'pr-split-b'}`} aria-hidden />
              <span>
                {t.match.hasBall(<b key="team">{team(sit.possession)!.name}</b>)}
                {sit.down && <span className="muted"> · {sit.down}</span>}
              </span>
              {sit.redZone && <span className="live-redzone">{t.match.redZone}</span>}
            </div>
          )}
          {sit.lastPlay && (
            <span className="muted small">
              {t.match.lastPlay(sit.lastPlay, sit.lastSide ? team(sit.lastSide)!.abbr : null)}
            </span>
          )}
        </section>
      )}

      {d.winProb.length > 1 && now && (
        <section className="card card-pad live-chart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="section-title" style={{ margin: 0 }}>
              {live ? t.match.winChances : t.match.gameStory}
            </span>
            {live && <span className="muted small">{t.match.byEspn}</span>}
          </div>
          {live && (
            <div className="live-now">
              <span>
                <b className="pr-a">{t.match.percent(Math.round(now.away))}</b> {game.away.abbr}
              </span>
              {game.myPick && (
                <span className="muted small">
                  {t.match.myPickChances(Math.round(game.myPick === 'away' ? now.away : 100 - now.away))}
                </span>
              )}
              <span>
                {game.home.abbr} <b className="pr-b">{t.match.percent(Math.round(100 - now.away))}</b>
              </span>
            </div>
          )}
          <WinChart data={d} awayAbbr={game.away.abbr} homeAbbr={game.home.abbr} />
        </section>
      )}

      {d.stats.length > 0 && (
        <section className="card card-pad live-stats">
          <div className="live-stats-head">
            <TeamLink abbr={game.away.abbr} className="pr-a">
              <b>{game.away.abbr}</b>
            </TeamLink>
            <span className="section-title" style={{ margin: 0 }}>{t.match.statsTitle}</span>
            <TeamLink abbr={game.home.abbr} className="pr-b">
              <b>{game.home.abbr}</b>
            </TeamLink>
          </div>
          {d.stats.map((st) => {
            const tot = st.awayValue + st.homeValue;
            const pa = tot ? (st.awayValue / tot) * 100 : 50;
            const better =
              st.awayValue === st.homeValue ? null : (st.awayValue > st.homeValue) !== st.lowerIsBetter ? 'away' : 'home';
            return (
              <div key={st.label} className="live-stat">
                <div className="live-stat-row">
                  <span className={better === 'away' ? 'live-stat-best pr-a' : undefined}>{st.away}</span>
                  <span className="muted small">{st.label}</span>
                  <span className={better === 'home' ? 'live-stat-best pr-b' : undefined}>{st.home}</span>
                </div>
                <div className="live-stat-bar" aria-hidden>
                  <span className={`pr-split-a${better === 'home' ? ' live-dim' : ''}`} style={{ width: `${pa}%` }} />
                  <span className={`pr-split-b${better === 'away' ? ' live-dim' : ''}`} style={{ width: `${100 - pa}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {d.leaders.length > 0 && (
        <section className="card card-pad live-leaders">
          <span className="section-title" style={{ margin: 0 }}>{t.match.leadersTitle}</span>
          {d.leaders.map((l) => (
            <div key={l.category} className="live-leader">
              <span className="muted small live-leader-cat">{l.category}</span>
              <div className="grid-2" style={{ gap: 12 }}>
                {(['away', 'home'] as const).map((s) => (
                  <div key={s} className="live-leader-p">
                    {l[s] ? (
                      <>
                        <b className={s === 'away' ? 'pr-a' : 'pr-b'}>{l[s]!.name}</b>
                        <span className="small">{l[s]!.line}</span>
                      </>
                    ) : (
                      <span className="muted small">–</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {d.scoring.length > 0 && (
        <section className="card card-pad live-scoring">
          <span className="section-title" style={{ margin: 0 }}>{t.match.scoringTitle}</span>
          <ol>
            {[...d.scoring].reverse().map((s, i) => (
              <li key={i}>
                <span className="live-when">
                  {t.match.period(s.period)}
                  <small>{s.clock}</small>
                </span>
                <span className="live-what">
                  <b className={s.side === 'away' ? 'pr-a' : s.side === 'home' ? 'pr-b' : undefined}>
                    {team(s.side)?.abbr ?? ''} · {s.kind}
                  </b>
                  <span className="muted small">{s.text}</span>
                </span>
                <span className="live-score">
                  {s.away}-{s.home}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

/** Courbe des chances de l'équipe à l'extérieur : au-dessus du milieu elle mène, en dessous c'est l'équipe à domicile. */
function WinChart({ data, awayAbbr, homeAbbr }: { data: LiveDto; awayAbbr: string; homeAbbr: string }) {
  const W = 340;
  const H = 140;
  const x = (sec: number) => (sec / data.length) * W;
  const y = (away: number) => H - (away / 100) * H;
  const pts = data.winProb.map((p) => `${x(p.t).toFixed(1)},${y(p.away).toFixed(1)}`);
  const last = data.winProb.at(-1)!;
  const area = `M0,${H / 2} L${pts.join(' L')} L${x(last.t).toFixed(1)},${H / 2} Z`;
  const quarters = [900, 1800, 2700, ...(data.length > 3600 ? [3600] : [])];
  const labels = [1, 2, 3, 4, ...(data.length > 3600 ? [5] : [])].map(t.match.period);
  const bounds = [0, ...quarters, data.length];

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="win-chart" role="img" aria-label={t.match.chartLabel(awayAbbr, homeAbbr)}>
      <defs>
        <clipPath id="wc-top">
          <rect x="0" y="0" width={W} height={H / 2} />
        </clipPath>
        <clipPath id="wc-bottom">
          <rect x="0" y={H / 2} width={W} height={H / 2} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="6" className="wc-bg" />
      {quarters.map((q) => (
        <line key={q} x1={x(q)} x2={x(q)} y1="0" y2={H} className="wc-grid" />
      ))}
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="wc-mid" />
      <path d={area} className="wc-area-a" clipPath="url(#wc-top)" />
      <path d={area} className="wc-area-b" clipPath="url(#wc-bottom)" />
      <polyline points={pts.join(' ')} className="wc-line" />
      <circle cx={x(last.t)} cy={y(last.away)} r="3.5" className="wc-dot" />
      <text x="6" y="14" className="wc-team pr-a-fill">{awayAbbr}</text>
      <text x="6" y={H - 6} className="wc-team pr-b-fill">{homeAbbr}</text>
      {labels.map((l, i) => (
        <text key={l} x={(x(bounds[i]) + x(bounds[i + 1])) / 2} y={H + 14} textAnchor="middle" className="wc-label">
          {l}
        </text>
      ))}
    </svg>
  );
}
