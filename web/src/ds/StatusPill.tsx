import type { ReactNode } from 'react';
import type { MatchStatus } from './types';
import './StatusPill.css';

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
