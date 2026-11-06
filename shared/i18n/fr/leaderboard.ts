/** The group's leaderboard. */
import { common } from './common';

export const leaderboard = {
  title: 'Classement',
  tabsLabel: 'Quel classement',
  tabBand: 'La bande',
  tabNfl: 'NFL',
  scopeSeason: 'Saison',
  scopeWeek: 'Semaine',

  /** Header: « Saison 2026 · 1 pt par bon prono, 2 en playoffs » or « … · reprise en semaine 9 ». */
  eyebrow: (season: number | string, startWeek: number, scoring: string) =>
    `Saison ${season} · ${startWeek > 1 ? `reprise en semaine ${startWeek}` : scoring}`,

  liveBadge: (games: number) => `En direct · ${common.matches(games)}`,
  liveTitle: 'Si ça finit comme ça…',
  liveHelp: 'Le classement tient compte des scores en cours et se met à jour tout seul. ✓ pronos en bonne voie, ✗ mal partis.',

  /** Under the name, during games: « 70 pts maintenant · ✓2 ✗1 · ↑1 ». */
  liveRecord: (points: number, winning: number, losing: number, move: number) => {
    const arrow = move > 0 ? ` · ↑${move}` : move < 0 ? ` · ↓${-move}` : '';
    const now = `${points} pts maintenant`;
    if (!winning && !losing) return `${now} · rien en jeu${arrow}`;
    return `${now} · ✓${winning} ✗${losing}${arrow}`;
  },
  /** Under the name, weekly leaderboard: « 8 bons sur 13 ». */
  weekRecord: (good: number, played: number) => (played ? `${good} bon${good > 1 ? 's' : ''} sur ${played}` : 'Pas encore de match terminé'),
  /**
   * Line under the name in the season leaderboard: « 81 / 135 », with carried-over points only
   * for those who have some (joined mid-season) and the bonus if any.
   */
  seasonRecord: (r: { good: number; played: number; startPoints: number; bonus: number }, startWeek: number) => {
    const bonus = r.bonus ? ` · +${r.bonus} bonus` : '';
    if (!r.played) return r.startPoints ? `${r.startPoints} pts de départ${bonus}` : `Pas encore de match terminé${bonus}`;
    const since = startWeek > 1 ? ` depuis la S${startWeek}` : '';
    const kept = r.startPoints ? ` · ${r.startPoints} repris` : '';
    return `${r.good} / ${r.played}${since}${kept}${bonus}`;
  },

  /** Rank superscript in the big card: « er » (1er), « e » (2e). */
  rankSuffix: (rank: number): string => (rank === 1 ? 'er' : 'e'),
  headline: (rank: number, live: boolean) => {
    if (live) return rank === 1 ? 'Tu finirais en tête' : rank <= 3 ? `Tu finirais ${rank}e, sur le podium` : `Tu finirais ${rank}e`;
    return rank === 1 ? 'Tu mènes la danse' : rank <= 3 ? 'Tu es sur le podium' : 'Accroche-toi';
  },
  aloneInFront: 'Seul en piste',
  tiedWith: (name: string) => `À égalité avec ${name}`,
  aheadOf: (gap: number, name: string) => `${common.points(gap)} d’avance sur ${name}`,
  /** « À 3 pts de Gwen · 2 pts devant Bea » */
  behind: (gap: number, leader: string, below: { gap: number; name: string } | null) =>
    `À ${common.points(gap)} de ${leader}${below ? ` · ${common.points(below.gap)} devant ${below.name}` : ''}`,

  recapButton: 'Récap de la semaine à partager',
  seasonButton: 'Bilan de saison',
  bonusButton: 'Bonus de fin de saison',
  previousSeasons: 'Saisons précédentes'
};
