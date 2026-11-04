import type { GameDto, TeamDto } from '../lib/api';
import type { MatchStatus, Team } from '../ds/components';

export function toTeam(t: TeamDto, theme: 'dark' | 'light'): Team {
  return { abbr: t.abbr, name: t.name, color: t.color, textColor: t.textColor, logoUrl: theme === 'dark' ? t.logoDark : t.logo };
}

/** Statut affiché sur la carte à partir de l'état du match côté serveur. */
export function cardStatus(g: GameDto): { status: MatchStatus; statusText?: string } {
  if (g.status === 'live') return { status: 'live', statusText: g.detail ? `En direct · ${g.detail}` : undefined };
  if (g.status === 'final') return { status: 'final', statusText: g.detail ?? undefined };
  if (g.status === 'postponed') return { status: 'locked', statusText: 'Reporté' };
  if (g.locked) return { status: 'locked' };
  return { status: 'open', statusText: g.points > 1 ? `Ouvert · ${g.points} pts` : undefined };
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </a>
  );
}

export function Loading() {
  return <p className="empty">Chargement…</p>;
}
