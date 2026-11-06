import { cx } from './cx';
import './Avatar.css';

/** "Gwenole" → "GW", "Jean Pierre" → "JP". */
export function initials(n: string) {
  const s = (n || '?').trim();
  const p = s.split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : s.slice(0, 2)).toUpperCase();
}

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

export function AvatarStack({ list, side, max = 4 }: { list: string[]; side: 'a' | 'b'; max?: number }) {
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
