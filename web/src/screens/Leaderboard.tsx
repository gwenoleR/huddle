import { type ReactNode, useState } from 'react';
import { NflStandings } from './NflStandings';
import { Button, LeaderboardRow, StatusPill } from '../ds';
import { type Me, type StandingRow } from '../lib/api';
import { go } from '../lib/router';
import { useBonus, useLeaderboard, useWeeks } from '../lib/data';
import { seasonRecord } from '../lib/labels';
import { config, t } from '../lib/i18n';
import { Loading, OtherSeasons } from './shared';

export function Leaderboard({ me, nfl, theme }: { me: Me; nfl: boolean; theme: 'dark' | 'light' }) {
  return nfl ? <NflStandings theme={theme} tabs={<LeagueTabs nfl />} /> : <BandLeaderboard me={me} tabs={<LeagueTabs nfl={false} />} />;
}

/** Toggles between the group leaderboard (default) and the NFL standings. */
function LeagueTabs({ nfl }: { nfl: boolean }) {
  return (
    <nav className="league-tabs" aria-label={t.leaderboard.tabsLabel}>
      <a href="#/standings" aria-current={nfl ? undefined : 'page'}>
        {t.leaderboard.tabBand}
      </a>
      <a href="#/standings/nfl" aria-current={nfl ? 'page' : undefined}>
        {t.leaderboard.tabNfl}
      </a>
    </nav>
  );
}

function BandLeaderboard({ me, tabs }: { me: Me; tabs: ReactNode }) {
  const [scope, setScope] = useState<'season' | 'week'>('season');
  const weeksQ = useWeeks();
  const weeks = weeksQ.data;
  const bonusOn = useBonus().data?.enabled ?? false;

  // During games the leaderboard moves: refresh it every 30 s.
  const week = scope === 'week' ? weeks?.current : undefined;
  const q = useLeaderboard(week, undefined, !!weeks);
  const data = q.data;
  const error = (q.error ?? weeksQ.error)?.message ?? null;
  const live = scope === 'season' ? data?.live ?? null : null;

  // Live, show the "if it ends like this" projection.
  const rows: StandingRow[] | null = live ? live.rows.map((r) => ({ ...r, points: r.projected, rank: r.projectedRank })) : data?.rows ?? null;
  const currentLabel = weeks?.weeks.find((w) => w.week === weeks.current)?.longLabel ?? '';
  const mine = rows?.find((r) => r.id === me.id);
  const leader = rows?.[0];

  function record(r: StandingRow): string {
    if (live) {
      const l = live.rows.find((x) => x.id === r.id)!;
      // ✓ picks on track, ✗ picks going wrong, in games in progress; arrow = places gained or lost
      return t.leaderboard.liveRecord(l.points, l.winning, l.losing, l.rank - l.projectedRank);
    }
    if (scope === 'week') return t.leaderboard.weekRecord(r.good, r.played);
    return seasonRecord(r, weeks?.startWeek ?? 1);
  }

  return (
    <div className="screen-inner">
      <header className="head" style={{ gap: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">
            {t.leaderboard.eyebrow(weeks?.season ?? '', weeks?.startWeek ?? 1, t.common.scoring(config.points.regular, config.points.playoffs))}
          </span>
          <h1 className="h1">{t.leaderboard.title}</h1>
        </div>
        {tabs}
        <div className="segmented">
          <Button variant={scope === 'season' ? 'primary' : 'secondary'} onClick={() => setScope('season')}>
            {t.leaderboard.scopeSeason}
          </Button>
          <Button variant={scope === 'week' ? 'primary' : 'secondary'} onClick={() => setScope('week')}>
            {currentLabel || t.leaderboard.scopeWeek}
          </Button>
        </div>
      </header>

      <main className="stack" style={{ gap: 16 }}>
        {error && <p className="error-box card">{error}</p>}
        {!rows && !error && <Loading />}
        {live && (
          <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatusPill status="live">{t.leaderboard.liveBadge(live.games)}</StatusPill>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t.leaderboard.liveTitle}</span>
            <span className="muted small">{t.leaderboard.liveHelp}</span>
          </section>
        )}
        {mine && leader && scope === 'season' && (
          <section className="card highlight">
            <span className="big-rank">
              {mine.rank}
              <sup>{t.leaderboard.rankSuffix(mine.rank)}</sup>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t.leaderboard.headline(mine.rank, !!live)}</span>
              <span className="muted small">{gapText(rows!, mine)}</span>
            </div>
          </section>
        )}
        {rows && (
          <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <LeaderboardRow key={r.id} rank={r.rank} name={r.name} points={r.points} me={r.id === me.id} record={record(r)} />
            ))}
          </ol>
        )}
        <Button block onClick={() => go('recap')}>
          {t.leaderboard.recapButton}
        </Button>
        <Button variant="secondary" block onClick={() => go('season')}>
          {t.leaderboard.seasonButton}
        </Button>
        {bonusOn && (
          <Button variant="secondary" block onClick={() => go('bonus')}>
            {t.leaderboard.bonusButton}
          </Button>
        )}
        {data && <OtherSeasons seasons={data.seasons} shown={data.season} current={data.season} label={t.leaderboard.previousSeasons} />}
      </main>
    </div>
  );
}

function gapText(rows: StandingRow[], mine: StandingRow) {
  if (mine.rank === 1) {
    const second = rows.find((r) => r.id !== mine.id);
    if (!second) return t.leaderboard.aloneInFront;
    const gap = mine.points - second.points;
    return gap === 0 ? t.leaderboard.tiedWith(second.name) : t.leaderboard.aheadOf(gap, second.name);
  }
  const leader = rows[0];
  const gap = leader.points - mine.points;
  const below = rows.find((r) => r.points < mine.points);
  return t.leaderboard.behind(gap, leader.name, below ? { gap: mine.points - below.points, name: below.name } : null);
}
