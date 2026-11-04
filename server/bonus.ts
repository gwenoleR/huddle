/**
 * Bonus de fin de saison : avant le premier match de Wild Card, chacun choisit le champion AFC,
 * le champion NFC et le vainqueur du Super Bowl, plus le total de points du Super Bowl pour départager.
 * Barème et activation réglables par l'admin (table meta), choix secrets jusqu'au coup d'envoi.
 */
import type { BonusPhase, BonusReveal, BonusSettingsDto } from '../shared/api';
import { SEASON } from './config';
import { db, getMeta, setMeta } from './db';
import { fetchStandings } from './espn';

export type { BonusPhase, BonusReveal };
/** Activation, barème et moment de la révélation, réglés par l'admin. */
export type BonusSettings = BonusSettingsDto;

const DEFAULTS: BonusSettings = { enabled: true, points: { afc: 3, nfc: 3, sb: 5 }, reveal: 'wildcard' };

export function bonusSettings(): BonusSettings {
  try {
    const s = JSON.parse(getMeta('bonus_settings') ?? 'null');
    if (s) return { enabled: !!s.enabled, points: { ...DEFAULTS.points, ...s.points }, reveal: s.reveal === 'superbowl' ? 'superbowl' : 'wildcard' };
  } catch {
    /* réglages illisibles : valeurs par défaut */
  }
  return DEFAULTS;
}

export function saveBonusSettings(s: BonusSettings) {
  setMeta('bonus_settings', JSON.stringify(s));
}

/** Les 7 qualifiés de chaque conférence, avec leur tête de série, figés à la fin de la saison régulière. */
export interface BonusField {
  afc: { teamId: string; seed: number }[];
  nfc: { teamId: string; seed: number }[];
}

export function bonusField(): BonusField | null {
  const raw = getMeta(`bonus_field:${SEASON}`);
  return raw ? (JSON.parse(raw) as BonusField) : null;
}

export interface BonusResult {
  afc: string | null;
  nfc: string | null;
  sb: string | null;
  sbTotal: number | null;
}

export function bonusResult(): BonusResult {
  const raw = getMeta(`bonus_result:${SEASON}`);
  return raw ? (JSON.parse(raw) as BonusResult) : { afc: null, nfc: null, sb: null, sbTotal: null };
}

/** Coup d'envoi du premier match de Wild Card (= clôture des choix). */
export function bonusLockAt(): number | null {
  const r = db.prepare('SELECT MIN(kickoff) AS k FROM games WHERE season = ? AND week = 19').get(SEASON) as { k: number | null };
  return r.k;
}

export function bonusPhase(now = Date.now()): BonusPhase {
  if (!bonusSettings().enabled) return 'off';
  const lock = bonusLockAt();
  if (!bonusField() || !lock) return 'waiting';
  return now < lock ? 'open' : 'locked';
}

/** Coup d'envoi du Super Bowl, s'il est déjà au calendrier. */
export function superBowlKickoff(): number | null {
  const r = db.prepare('SELECT MIN(kickoff) AS k FROM games WHERE season = ? AND week = 22').get(SEASON) as { k: number | null };
  return r.k;
}

/** Moment où les choix de la bande deviennent visibles (null si pas encore connu). */
export function bonusRevealAt(): number | null {
  return bonusSettings().reveal === 'superbowl' ? superBowlKickoff() : bonusLockAt();
}

/** Les choix (et donc les points bonus) sont-ils dévoilés ? */
export function bonusRevealed(now = Date.now()): boolean {
  if (bonusPhase(now) !== 'locked') return false;
  const at = bonusRevealAt();
  return at != null && now >= at;
}

export interface BonusPick {
  playerId: number;
  afc: string;
  nfc: string;
  sb: string;
  sbTotal: number;
}

export function bonusPicks(): BonusPick[] {
  return db
    .prepare('SELECT player_id AS playerId, afc, nfc, sb, sb_total AS sbTotal FROM bonus_picks WHERE season = ?')
    .all(SEASON) as unknown as BonusPick[];
}

export function saveBonusPick(p: BonusPick) {
  db.prepare(
    `INSERT INTO bonus_picks (player_id, season, afc, nfc, sb, sb_total, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id, season) DO UPDATE SET afc = excluded.afc, nfc = excluded.nfc, sb = excluded.sb,
       sb_total = excluded.sb_total, updated_at = excluded.updated_at`
  ).run(p.playerId, SEASON, p.afc, p.nfc, p.sb, p.sbTotal, Date.now());
}

/** Points bonus gagnés par joueur (0 si la fonction est désactivée ou si rien n'est encore joué). */
export function bonusPointsByPlayer(): Map<number, number> {
  const out = new Map<number, number>();
  const s = bonusSettings();
  // Tant que les choix sont secrets, les points bonus aussi : sinon le classement trahirait qui a quoi.
  if (!s.enabled || !bonusRevealed()) return out;
  const r = bonusResult();
  for (const p of bonusPicks()) {
    const pts = (r.afc && p.afc === r.afc ? s.points.afc : 0) + (r.nfc && p.nfc === r.nfc ? s.points.nfc : 0) + (r.sb && p.sb === r.sb ? s.points.sb : 0);
    out.set(p.playerId, pts);
  }
  return out;
}

/** Écart au vrai total du Super Bowl, pour départager les égalités. null tant que le Super Bowl n'est pas joué. */
export function tiebreakDistances(): Map<number, number> | null {
  if (!bonusSettings().enabled) return null;
  const total = bonusResult().sbTotal;
  if (total == null) return null;
  return new Map(bonusPicks().map((p) => [p.playerId, Math.abs(p.sbTotal - total)]));
}

/**
 * Appelé chaque minute : fige les qualifiés quand la saison régulière est finie et les Wild Cards connues,
 * puis note les champions au fil des playoffs.
 */
export async function bonusTick() {
  if (!bonusSettings().enabled) return;

  if (!bonusField()) {
    const w18 = db
      .prepare("SELECT COUNT(*) AS n, SUM(status = 'final') AS f FROM games WHERE season = ? AND week = 18")
      .get(SEASON) as { n: number; f: number | null };
    const wc = db.prepare('SELECT COUNT(*) AS n FROM games WHERE season = ? AND week = 19').get(SEASON) as { n: number };
    if (!w18.n || w18.f !== w18.n || !wc.n) return;
    const s = await fetchStandings(SEASON);
    const confTeams = (abbr: string) =>
      (s.conferences.find((c) => c.abbr === abbr)?.divisions ?? [])
        .flatMap((d) => d.teams)
        .filter((t) => t.seed != null && t.seed <= 7)
        .map((t) => ({ teamId: t.teamId, seed: t.seed! }))
        .sort((a, b) => a.seed - b.seed);
    const field = { afc: confTeams('AFC'), nfc: confTeams('NFC') };
    if (field.afc.length !== 7 || field.nfc.length !== 7) return; // classement pas encore à jour chez ESPN
    setMeta(`bonus_field:${SEASON}`, JSON.stringify(field));
    console.log('[bonus] qualifiés figés, les choix sont ouverts');
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
    .all(SEASON) as { week: number; winner: string | null; away_id: string; home_id: string; away_score: number; home_score: number }[];
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
  // Les deux finalistes du Super Bowl sont aussi les champions de conférence (au cas où la finale de conf. manquerait).
  const sbGame = db.prepare('SELECT away_id, home_id FROM games WHERE season = ? AND week = 22').get(SEASON) as
    | { away_id: string; home_id: string }
    | undefined;
  if (sbGame) {
    for (const id of [sbGame.away_id, sbGame.home_id]) {
      if (afcIds.has(id)) result.afc ??= id;
      if (nfcIds.has(id)) result.nfc ??= id;
    }
  }
  const prev = getMeta(`bonus_result:${SEASON}`);
  const next = JSON.stringify(result);
  if (prev !== next) setMeta(`bonus_result:${SEASON}`, next);
}
