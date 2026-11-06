/**
 * End-of-season bonus: before the first Wild Card game, everyone picks the AFC champion,
 * the NFC champion and the Super Bowl winner, plus the Super Bowl total points as a tiebreaker.
 * Scoring and activation are set by the admin (meta table); picks stay secret until kickoff.
 */
import type { BonusPhase, BonusReveal, BonusSettingsDto } from '../shared/api';
import { currentSeason } from './config';
import { db, getMeta, setMeta } from './db';
import { fetchStandings } from './espn';

export type { BonusPhase, BonusReveal };
/** Activation, scoring and reveal moment, set by the admin. */
export type BonusSettings = BonusSettingsDto;

const DEFAULTS: BonusSettings = { enabled: true, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' };

export function bonusSettings(): BonusSettings {
  try {
    const s = JSON.parse(getMeta('bonus_settings') ?? 'null');
    if (s) return { enabled: !!s.enabled, points: { ...DEFAULTS.points, ...s.points }, reveal: s.reveal === 'superbowl' ? 'superbowl' : 'wildcard' };
  } catch {
    /* unreadable settings: use defaults */
  }
  return DEFAULTS;
}

export function saveBonusSettings(s: BonusSettings) {
  setMeta('bonus_settings', JSON.stringify(s));
}

/** Each conference's 7 qualified teams, with their seed, frozen at the end of the regular season. */
export interface BonusField {
  afc: { teamId: string; seed: number }[];
  nfc: { teamId: string; seed: number }[];
}

export function bonusField(season = currentSeason()): BonusField | null {
  const raw = getMeta(`bonus_field:${season}`);
  return raw ? (JSON.parse(raw) as BonusField) : null;
}

export interface BonusResult {
  afc: string | null;
  nfc: string | null;
  sb: string | null;
  sbTotal: number | null;
}

export function bonusResult(season = currentSeason()): BonusResult {
  const raw = getMeta(`bonus_result:${season}`);
  return raw ? (JSON.parse(raw) as BonusResult) : { afc: null, nfc: null, sb: null, sbTotal: null };
}

/** Kickoff of the first Wild Card game (= picks close). */
export function bonusLockAt(season = currentSeason()): number | null {
  const r = db.prepare('SELECT MIN(kickoff) AS k FROM games WHERE season = ? AND week = 19').get(season) as { k: number | null };
  return r.k;
}

export function bonusPhase(now = Date.now(), season = currentSeason()): BonusPhase {
  if (!bonusSettings().enabled) return 'off';
  const lock = bonusLockAt(season);
  if (!bonusField(season) || !lock) return 'waiting';
  return now < lock ? 'open' : 'locked';
}

/** Super Bowl kickoff, if already scheduled. */
export function superBowlKickoff(season = currentSeason()): number | null {
  const r = db.prepare('SELECT MIN(kickoff) AS k FROM games WHERE season = ? AND week = 22').get(season) as { k: number | null };
  return r.k;
}

/** When the group's picks become visible (null if not known yet). */
export function bonusRevealAt(season = currentSeason()): number | null {
  return bonusSettings().reveal === 'superbowl' ? superBowlKickoff(season) : bonusLockAt(season);
}

/** Are the picks (and therefore the bonus points) revealed? */
export function bonusRevealed(now = Date.now(), season = currentSeason()): boolean {
  if (bonusPhase(now, season) !== 'locked') return false;
  const at = bonusRevealAt(season);
  return at != null && now >= at;
}

export interface BonusPick {
  playerId: number;
  afc: string;
  nfc: string;
  sb: string;
  sbTotal: number;
}

export function bonusPicks(season = currentSeason()): BonusPick[] {
  return db
    .prepare('SELECT player_id AS playerId, afc, nfc, sb, sb_total AS sbTotal FROM bonus_picks WHERE season = ?')
    .all(season) as unknown as BonusPick[];
}

export function saveBonusPick(p: BonusPick) {
  db.prepare(
    `INSERT INTO bonus_picks (player_id, season, afc, nfc, sb, sb_total, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id, season) DO UPDATE SET afc = excluded.afc, nfc = excluded.nfc, sb = excluded.sb,
       sb_total = excluded.sb_total, updated_at = excluded.updated_at`
  ).run(p.playerId, currentSeason(), p.afc, p.nfc, p.sb, p.sbTotal, Date.now());
}

/** Bonus points earned per player (0 if the feature is disabled or nothing has been played yet). */
export function bonusPointsByPlayer(season = currentSeason()): Map<number, number> {
  const out = new Map<number, number>();
  const s = bonusSettings();
  // As long as picks are secret, so are bonus points: otherwise the leaderboard would give away who picked what.
  if (!s.enabled || !bonusRevealed(Date.now(), season)) return out;
  const r = bonusResult(season);
  for (const p of bonusPicks(season)) {
    const pts = (r.afc && p.afc === r.afc ? s.points.afc : 0) + (r.nfc && p.nfc === r.nfc ? s.points.nfc : 0) + (r.sb && p.sb === r.sb ? s.points.sb : 0);
    out.set(p.playerId, pts);
  }
  return out;
}

/** Distance from the actual Super Bowl total, to break ties. null until the Super Bowl is played. */
export function tiebreakDistances(season = currentSeason()): Map<number, number> | null {
  if (!bonusSettings().enabled) return null;
  const total = bonusResult(season).sbTotal;
  if (total == null) return null;
  return new Map(bonusPicks(season).map((p) => [p.playerId, Math.abs(p.sbTotal - total)]));
}

/**
 * Called every minute: freezes the qualified teams once the regular season is over and the Wild Cards are known,
 * then records the champions as the playoffs go.
 */
export async function bonusTick() {
  const season = currentSeason();
  if (!bonusSettings().enabled) return;

  if (!bonusField()) {
    const w18 = db
      .prepare("SELECT COUNT(*) AS n, SUM(status = 'final') AS f FROM games WHERE season = ? AND week = 18")
      .get(season) as { n: number; f: number | null };
    const wc = db.prepare('SELECT COUNT(*) AS n FROM games WHERE season = ? AND week = 19').get(season) as { n: number };
    if (!w18.n || w18.f !== w18.n || !wc.n) return;
    const s = await fetchStandings(season);
    const confTeams = (abbr: string) =>
      (s.conferences.find((c) => c.abbr === abbr)?.divisions ?? [])
        .flatMap((d) => d.teams)
        .filter((t) => t.seed != null && t.seed <= 7)
        .map((t) => ({ teamId: t.teamId, seed: t.seed! }))
        .sort((a, b) => a.seed - b.seed);
    const field = { afc: confTeams('AFC'), nfc: confTeams('NFC') };
    if (field.afc.length !== 7 || field.nfc.length !== 7) return; // standings not yet up to date at ESPN
    setMeta(`bonus_field:${season}`, JSON.stringify(field));
    console.log('[bonus] qualified teams frozen, picks are open');
    return;
  }

  const field = bonusField()!;
  const afcIds = new Set(field.afc.map((t) => t.teamId));
  const nfcIds = new Set(field.nfc.map((t) => t.teamId));
  const winnerId = (g: { winner: string | null; away_id: string; home_id: string }) =>
    g.winner === 'away' ? g.away_id : g.winner === 'home' ? g.home_id : null;

  const result: BonusResult = { afc: null, nfc: null, sb: null, sbTotal: null };
  const finals = db
    .prepare("SELECT week, winner, away_id, home_id, away_score, home_score FROM games WHERE season = ? AND week IN (21, 22) AND status = 'final'")
    .all(season) as { week: number; winner: string | null; away_id: string; home_id: string; away_score: number; home_score: number }[];
  for (const g of finals) {
    const w = winnerId(g);
    if (g.week === 21 && w) {
      if (afcIds.has(w)) result.afc = w;
      if (nfcIds.has(w)) result.nfc = w;
    }
    if (g.week === 22) {
      result.sb = w;
      result.sbTotal = g.away_score + g.home_score;
    }
  }
  // Both Super Bowl finalists are also the conference champions (in case the conference final is missing).
  const sbGame = db.prepare('SELECT away_id, home_id FROM games WHERE season = ? AND week = 22').get(season) as
    | { away_id: string; home_id: string }
    | undefined;
  if (sbGame) {
    for (const id of [sbGame.away_id, sbGame.home_id]) {
      if (afcIds.has(id)) result.afc ??= id;
      if (nfcIds.has(id)) result.nfc ??= id;
    }
  }
  const prev = getMeta(`bonus_result:${season}`);
  const next = JSON.stringify(result);
  if (prev !== next) setMeta(`bonus_result:${season}`, next);
}
