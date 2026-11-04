import { Avatar } from './Avatar';
import { cx } from './cx';
import './LeaderboardRow.css';

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
