import { openTeam } from '../lib/teamSheet';
import type { GameDto, TeamDto } from '../lib/api';
import type { MatchStatus, Team } from '../ds';
import { t } from '../lib/i18n';

export function toTeam(team: TeamDto, theme: 'dark' | 'light'): Team {
  return { abbr: team.abbr, name: team.name, color: team.color, textColor: team.textColor, logoUrl: theme === 'dark' ? team.logoDark : team.logo };
}

/** Status shown on the card, derived from the server-side game state. */
export function cardStatus(g: GameDto): { status: MatchStatus; statusText?: string } {
  if (g.status === 'live') return { status: 'live', statusText: g.detail ? t.matches.live(g.detail) : undefined };
  if (g.status === 'final') return { status: 'final', statusText: g.detail ?? undefined };
  if (g.status === 'postponed') return { status: 'locked', statusText: t.matches.postponed };
  if (g.locked) return { status: 'locked' };
  return { status: 'open', statusText: g.points > 1 ? t.matches.openPoints(g.points) : undefined };
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
 * Discreet link to the other seasons' recaps, at the bottom of the page: it isn't used often.
 * Nothing while there is only one season. current = the current season (its recap is "#/season").
 */
export function OtherSeasons({ seasons, shown, current, label }: { seasons: number[]; shown: number; current: number; label: string }) {
  const others = seasons.filter((s) => s !== shown);
  if (!others.length) return null;
  return (
    <p className="muted small other-seasons">
      {t.ds.listLabel(label)}{' '}
      {others.map((s, i) => (
        <span key={s}>
          {i > 0 && ' · '}
          <a href={s === current ? '#/season' : `#/season/${s}`}>{s}</a>
        </span>
      ))}
    </p>
  );
}

export function Loading() {
  return <p className="empty">{t.ds.loading}</p>;
}

/** Clickable team name that opens its page (never on the pick buttons). */
export function TeamLink({ abbr, className, children }: { abbr: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={`team-link${className ? ` ${className}` : ''}`} onClick={() => openTeam(abbr)}>
      {children}
    </button>
  );
}
