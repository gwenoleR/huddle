import { cx } from './cx';
import type { Team } from './types';
import './TeamBadge.css';

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
