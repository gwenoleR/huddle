/**
 * Composants du design system « Prono NFL entre potes », portés du bundle en TSX.
 * Source : https://claude.ai/artifact/LumqadSKDa1KpdGUebdBNh — mêmes classes CSS (components.css).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

function initials(n: string) {
  const s = (n || '?').trim();
  const p = s.split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : s.slice(0, 2)).toUpperCase();
}

export interface Team {
  abbr: string;
  name: string;
  color?: string;
  textColor?: string;
  logoUrl?: string;
}

export type Side = 'away' | 'home';
export type MatchStatus = 'open' | 'locked' | 'live' | 'final';

// ---------- Button ----------

export function Button({
  variant = 'primary',
  block,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; block?: boolean }) {
  return <button type="button" {...rest} className={cx('pr-btn', `pr-btn-${variant}`, block && 'pr-btn-block', className)} />;
}

// ---------- StatusPill ----------

const STATUS: Record<string, string> = {
  open: 'Ouvert',
  locked: 'Verrouillé',
  live: 'En direct',
  final: 'Terminé',
  win: 'Bon prono',
  loss: 'Raté'
};

export function StatusPill({ status = 'open', children }: { status?: MatchStatus | 'win' | 'loss'; children?: ReactNode }) {
  return (
    <span className={`pr-pill pr-pill-${status}`}>
      {status === 'live' && <span className="pr-dot" aria-hidden />}
      {status === 'win' && <span aria-hidden>✓</span>}
      {status === 'loss' && <span aria-hidden>✗</span>}
      {children ?? STATUS[status]}
    </span>
  );
}

// ---------- Avatar ----------

export function Avatar({
  name,
  src,
  size = 'md',
  side,
  me
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  side?: 'a' | 'b';
  me?: boolean;
}) {
  return (
    <span
      className={cx('pr-avatar', `pr-avatar-${size}`, side && `pr-avatar-${side}`, me && 'pr-avatar-me')}
      title={name}
      aria-label={name}
      role="img"
    >
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

function AvatarStack({ list, side, max = 4 }: { list: string[]; side: 'a' | 'b'; max?: number }) {
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <span className={cx('pr-stack', side === 'b' && 'pr-stack-end')}>
      {shown.map((n) => (
        <Avatar key={n} name={n} size="sm" side={side} />
      ))}
      {more > 0 && <span className="pr-avatar pr-avatar-sm pr-more">+{more}</span>}
    </span>
  );
}

// ---------- TeamBadge ----------

export function TeamBadge({
  team,
  size = 'md',
  showName,
  align
}: {
  team: Team;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  align?: 'start' | 'end';
}) {
  const disc = (
    <span
      className={cx('pr-logo', `pr-logo-${size}`, team.logoUrl && 'pr-logo-img')}
      style={team.logoUrl ? undefined : { background: team.color ?? 'var(--surface-200)', color: team.textColor ?? 'var(--ink)' }}
      aria-hidden={showName ? true : undefined}
    >
      {team.logoUrl ? <img src={team.logoUrl} alt={team.name} loading="lazy" /> : team.abbr}
    </span>
  );
  if (!showName)
    return (
      <span className="pr-team" title={team.name}>
        {disc}
      </span>
    );
  return (
    <span className={cx('pr-team', 'pr-team-named', align === 'end' && 'pr-team-end')}>
      {disc}
      <span className="pr-team-text">
        <span className="pr-team-abbr">{team.abbr}</span>
        <span className="pr-team-name">{team.name}</span>
      </span>
    </span>
  );
}

// ---------- PickSplit ----------

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

// ---------- MatchCard ----------

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
  /** Ajout de l'appli : lien « Voir qui a pris quoi » sous la répartition. */
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

// ---------- WeekPicker ----------

export function WeekPicker({
  weeks,
  value,
  onChange
}: {
  weeks: { id: number; label: string }[];
  value: number;
  onChange?: (id: number) => void;
}) {
  return (
    <nav className="pr-weeks" aria-label="Semaine">
      {weeks.map((w) => {
        const on = w.id === value;
        return (
          <button
            key={w.id}
            type="button"
            className={cx('pr-week', on && 'pr-week-on')}
            aria-current={on ? 'true' : undefined}
            data-week={w.id}
            onClick={onChange ? () => onChange(w.id) : undefined}
          >
            {w.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------- LeaderboardRow ----------

export function LeaderboardRow({
  rank,
  name,
  points,
  record,
  avatar,
  me
}: {
  rank: number;
  name: string;
  points: number;
  record?: string;
  avatar?: string;
  me?: boolean;
}) {
  return (
    <li className={cx('pr-lb', me && 'pr-lb-me')}>
      <span className={cx('pr-rank', rank <= 3 && `pr-rank-${rank}`)}>{rank}</span>
      <Avatar name={name} src={avatar} me={me} />
      <span className="pr-lb-main">
        <span className="pr-lb-name">
          {name}
          {me && <span className="pr-lb-you"> · toi</span>}
        </span>
        {record && <span className="pr-lb-rec">{record}</span>}
      </span>
      <span className="pr-lb-pts">
        {points}
        <small> pts</small>
      </span>
    </li>
  );
}

// ---------- BottomNav ----------

const ICONS: Record<string, string[]> = {
  matchs: ['M4 20C4 11 11 4 20 4c0 9-7 16-16 16z', 'M9 15l6-6', 'M10.5 10.5l1.5 1.5', 'M12.5 8.5l1.5 1.5', 'M8.5 12.5l1.5 1.5'],
  classement: ['M7 4h10v4a5 5 0 0 1-10 0z', 'M7 6H4a3 3 0 0 0 3 4', 'M17 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8', 'M9 17h6'],
  profil: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6']
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICONS[name] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function BottomNav({ active, onChange }: { active: string; onChange?: (id: string) => void }) {
  const items = [
    { id: 'matchs', label: 'Matchs' },
    { id: 'classement', label: 'Classement' },
    { id: 'profil', label: 'Profil' }
  ];
  return (
    <nav className="pr-nav" aria-label="Navigation principale">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            className={cx('pr-nav-item', on && 'pr-nav-on')}
            aria-current={on ? 'page' : undefined}
            onClick={onChange ? () => onChange(it.id) : undefined}
          >
            <Icon name={it.id} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
