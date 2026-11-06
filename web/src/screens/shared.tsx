import { openTeam } from '../lib/teamSheet';
import type { GameDto, TeamDto } from '../lib/api';
import type { MatchStatus, Team } from '../ds';

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
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </a>
  );
}

/**
 * Lien discret vers le bilan des autres saisons, en bas de page : on ne s'en sert pas souvent.
 * Rien tant qu'il n'y a qu'une saison. current = la saison en cours (son bilan est « #/bilan »).
 */
export function OtherSeasons({ seasons, shown, current, label }: { seasons: number[]; shown: number; current: number; label: string }) {
  const others = seasons.filter((s) => s !== shown);
  if (!others.length) return null;
  return (
    <p className="muted small other-seasons">
      {label} :{' '}
      {others.map((s, i) => (
        <span key={s}>
          {i > 0 && ' · '}
          <a href={s === current ? '#/bilan' : `#/bilan/${s}`}>{s}</a>
        </span>
      ))}
    </p>
  );
}

export function Loading() {
  return <p className="empty">Chargement…</p>;
}

/** Nom d'équipe cliquable qui ouvre sa fiche (jamais sur les boutons de prono). */
export function TeamLink({ abbr, className, children }: { abbr: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={`team-link${className ? ` ${className}` : ''}`} onClick={() => openTeam(abbr)}>
      {children}
    </button>
  );
}
