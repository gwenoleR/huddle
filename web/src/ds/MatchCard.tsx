import type { ReactNode } from 'react';
import { AvatarStack } from './Avatar';
import { cx } from './cx';
import { StatusPill } from './StatusPill';
import { TeamBadge } from './TeamBadge';
import type { Side, Team, MatchStatus } from './types';
import './MatchCard.css';

export function PickSplit({
  away,
  home,
  awayPickers = [],
  homePickers = [],
  max,
  emptyText
}: {
  away: Team;
  home: Team;
  awayPickers?: string[];
  homePickers?: string[];
  max?: number;
  emptyText?: string;
}) {
  const tot = awayPickers.length + homePickers.length;
  const pa = tot ? Math.round((awayPickers.length * 100) / tot) : 50;
  return (
    <div className={cx('pr-split', !tot && 'pr-split-empty')}>
      <div className="pr-split-labels">
        <span className="pr-split-lab">
          <b className="pr-a">{awayPickers.length}</b> {away.abbr}
        </span>
        {!tot && <span className="pr-split-none">{emptyText ?? 'Personne n’a encore joué'}</span>}
        <span className="pr-split-lab">
          {home.abbr} <b className="pr-b">{homePickers.length}</b>
        </span>
      </div>
      <div
        className="pr-split-bar"
        role="img"
        aria-label={`${awayPickers.length} pour ${away.name}, ${homePickers.length} pour ${home.name}`}
      >
        <span className="pr-split-a" style={{ width: `${pa}%` }} />
        <span className="pr-split-b" style={{ width: `${100 - pa}%` }} />
      </div>
      {tot > 0 && (
        <div className="pr-split-people">
          <AvatarStack list={awayPickers} side="a" max={max} />
          <AvatarStack list={homePickers} side="b" max={max} />
        </div>
      )}
    </div>
  );
}

export function MatchCard({
  away,
  home,
  kickoff,
  status = 'open',
  statusText,
  myPick,
  score,
  awayPickers,
  homePickers,
  onPick,
  footer,
  emptyText
}: {
  away: Team;
  home: Team;
  kickoff: string;
  status?: MatchStatus;
  statusText?: string;
  myPick?: Side | null;
  score?: { away: number; home: number } | null;
  awayPickers?: string[];
  homePickers?: string[];
  onPick?: (side: Side) => void;
  /** Ajout de l'appli : lien vers la fiche match sous la répartition. */
  footer?: ReactNode;
  /** Texte de la répartition quand personne n'a joué. */
  emptyText?: string;
}) {
  const canPick = status === 'open' && !!onPick;
  const winner = score && status === 'final' ? (score.away > score.home ? 'away' : score.home > score.away ? 'home' : null) : null;
  const verdict = status === 'final' && myPick ? (winner === myPick ? 'win' : 'loss') : null;

  const side = (key: Side, team: Team) => {
    const picked = myPick === key;
    const lost = winner && winner !== key;
    return (
      <button
        type="button"
        className={cx('pr-side', picked && 'pr-side-picked', lost && 'pr-side-lost', canPick && 'pr-side-live')}
        disabled={!canPick}
        aria-pressed={picked}
        aria-label={`${team.name}${picked ? ', ton prono' : ''}`}
        onClick={canPick ? () => onPick!(key) : undefined}
      >
        <TeamBadge team={team} size="lg" />
        <span className="pr-side-abbr">{team.abbr}</span>
        <span className="pr-side-name">{team.name}</span>
        <span className={cx('pr-mine', !picked && 'pr-mine-off')}>Ton prono</span>
      </button>
    );
  };

  return (
    <article className={cx('pr-match', verdict && `pr-match-${verdict}`)}>
      <header className="pr-match-head">
        <StatusPill status={verdict ?? status}>{verdict ? undefined : statusText}</StatusPill>
        <span className="pr-kick">{kickoff}</span>
      </header>
      <div className="pr-match-body">
        {side('away', away)}
        <div className="pr-mid">
          {score ? (
            <span className="pr-score">
              {score.away}
              <span className="pr-score-sep">–</span>
              {score.home}
            </span>
          ) : (
            <span className="pr-at">@</span>
          )}
        </div>
        {side('home', home)}
      </div>
      <PickSplit away={away} home={home} awayPickers={awayPickers} homePickers={homePickers} emptyText={emptyText} />
      {footer}
    </article>
  );
}
