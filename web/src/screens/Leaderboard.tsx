import { type ReactNode, useState } from 'react';
import { NflStandings } from './NflStandings';
import { Button, LeaderboardRow, StatusPill } from '../ds';
import { type Me, type StandingRow } from '../lib/api';
import { plural } from '../lib/format';
import { go } from '../lib/router';
import { useBonus, useLeaderboard, useWeeks } from '../lib/data';
import { seasonRecord } from '../lib/labels';
import { Loading, OtherSeasons } from './shared';

export function Leaderboard({ me, nfl, theme }: { me: Me; nfl: boolean; theme: 'dark' | 'light' }) {
  return nfl ? <NflStandings theme={theme} tabs={<LeagueTabs nfl />} /> : <BandeLeaderboard me={me} tabs={<LeagueTabs nfl={false} />} />;
}

/** Bascule entre le classement de la bande (par défaut) et celui de la NFL. */
function LeagueTabs({ nfl }: { nfl: boolean }) {
  return (
    <nav className="league-tabs" aria-label="Quel classement">
      <a href="#/classement" aria-current={nfl ? undefined : 'page'}>
        La bande
      </a>
      <a href="#/classement/nfl" aria-current={nfl ? 'page' : undefined}>
        NFL
      </a>
    </nav>
  );
}

function BandeLeaderboard({ me, tabs }: { me: Me; tabs: ReactNode }) {
  const [scope, setScope] = useState<'season' | 'week'>('season');
  const weeksQ = useWeeks();
  const weeks = weeksQ.data;
  const bonusOn = useBonus().data?.enabled ?? false;

  // Pendant les matchs, le classement bouge : on le rafraîchit toutes les 30 s.
  const week = scope === 'week' ? weeks?.current : undefined;
  const q = useLeaderboard(week, undefined, !!weeks);
  const data = q.data;
  const error = (q.error ?? weeksQ.error)?.message ?? null;
  const live = scope === 'season' ? data?.live ?? null : null;

  // En direct, on affiche la projection « si ça finit comme ça ».
  const rows: StandingRow[] | null = live ? live.rows.map((r) => ({ ...r, points: r.projected, rank: r.projectedRank })) : data?.rows ?? null;
  const currentLabel = weeks?.weeks.find((w) => w.week === weeks.current)?.longLabel ?? '';
  const mine = rows?.find((r) => r.id === me.id);
  const leader = rows?.[0];

  function record(r: StandingRow): string {
    if (live) {
      const l = live.rows.find((x) => x.id === r.id)!;
      const move = l.rank - l.projectedRank;
      const arrow = move > 0 ? ` · ↑${move}` : move < 0 ? ` · ↓${-move}` : '';
      const now = `${l.points} pts maintenant`;
      if (!l.winning && !l.losing) return `${now} · rien en jeu${arrow}`;
      // ✓ pronos en bonne voie, ✗ mal partis, dans les matchs en cours
      return `${now} · ✓${l.winning} ✗${l.losing}${arrow}`;
    }
    if (scope === 'week') return r.played ? `${r.good} bon${r.good > 1 ? 's' : ''} sur ${r.played}` : 'Pas encore de match terminé';
    return seasonRecord(r, weeks?.startWeek ?? 1);
  }

  return (
    <div className="screen-inner">
      <header className="head" style={{ gap: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">
            Saison {weeks?.season ?? ''}
            {weeks && weeks.startWeek > 1 ? ` · reprise en semaine ${weeks.startWeek}` : ' · 1 pt par bon prono, 2 en playoffs'}
          </span>
          <h1 className="h1">Classement</h1>
        </div>
        {tabs}
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
        {live && (
          <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatusPill status="live">En direct · {plural(live.games, 'match')}</StatusPill>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Si ça finit comme ça…</span>
            <span className="muted small">
              Le classement tient compte des scores en cours et se met à jour tout seul. ✓ pronos en bonne voie, ✗ mal partis.
            </span>
          </section>
        )}
        {mine && leader && scope === 'season' && (
          <section className="card highlight">
            <span className="big-rank">
              {mine.rank}
              <sup>{mine.rank === 1 ? 'er' : 'e'}</sup>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{headline(mine.rank, !!live)}</span>
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
          Récap de la semaine à partager
        </Button>
        <Button variant="secondary" block onClick={() => go('bilan')}>
          Bilan de saison
        </Button>
        {bonusOn && (
          <Button variant="secondary" block onClick={() => go('bonus')}>
            Bonus de fin de saison
          </Button>
        )}
        {data && <OtherSeasons seasons={data.seasons} shown={data.season} current={data.season} label="Saisons précédentes" />}
      </main>
    </div>
  );
}

function headline(rank: number, live: boolean) {
  if (live) return rank === 1 ? 'Tu finirais en tête' : rank <= 3 ? `Tu finirais ${rank}e, sur le podium` : `Tu finirais ${rank}e`;
  return rank === 1 ? 'Tu mènes la danse' : rank <= 3 ? 'Tu es sur le podium' : 'Accroche-toi';
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
