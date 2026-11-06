import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { SyncStatusDto } from '../shared/api';
import { DATA_DIR, currentSeason, t } from './config';

export type SyncStatus = Omit<SyncStatusDto, 'espn'>;
import { db, getMeta, setMeta, transaction } from './db';
import { APP_WEEKS, fetchTeams, fetchWeek, logoUrl, type EspnGame } from './espn';

const LOGO_DIR = path.join(DATA_DIR, 'logos');
export { LOGO_DIR };

const HOUR = 60 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Petite pause entre deux semaines pour ne pas mitrailler ESPN (0 dans les tests). */
const PAUSE_MS = Number(process.env.SYNC_PAUSE_MS ?? 300);

export async function syncTeams() {
  const teams = await fetchTeams();
  const up = db.prepare(`
    INSERT INTO teams (id, abbr, name, display_name, color, alt_color) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET abbr = excluded.abbr, name = excluded.name, display_name = excluded.display_name,
      color = excluded.color, alt_color = excluded.alt_color`);
  transaction(() => {
    for (const t of teams) up.run(t.id, t.abbr, t.name, t.displayName, t.color, t.altColor);
  });

  // Logos téléchargés une fois et servis par notre serveur : les téléphones ne dépendent pas d'ESPN.
  mkdirSync(LOGO_DIR, { recursive: true });
  for (const t of teams) {
    for (const dark of [false, true]) {
      const file = path.join(LOGO_DIR, `${t.abbr.toLowerCase()}${dark ? '-dark' : ''}.png`);
      if (existsSync(file)) continue;
      try {
        const res = await fetch(logoUrl(t.abbr, dark), { signal: AbortSignal.timeout(15_000) });
        if (res.ok) writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      } catch (e) {
        console.warn(`[sync] logo ${t.abbr} indisponible`, (e as Error).message);
      }
    }
  }
  return teams.length;
}

const upsertGame = () =>
  db.prepare(`
    INSERT INTO games (id, season, week, kickoff, status, detail, away_id, home_id, away_score, home_score, winner, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET week = excluded.week, kickoff = excluded.kickoff, status = excluded.status,
      detail = excluded.detail, away_id = excluded.away_id, home_id = excluded.home_id, away_score = excluded.away_score,
      home_score = excluded.home_score, winner = excluded.winner, updated_at = excluded.updated_at`);

export async function syncWeek(week: number) {
  const games = await fetchWeek(currentSeason(), week);
  const known = new Set((db.prepare('SELECT id FROM teams').all() as { id: string }[]).map((r) => r.id));
  const valid = games.filter((g: EspnGame) => known.has(g.awayId) && known.has(g.homeId));
  const stmt = upsertGame();
  const now = Date.now();
  transaction(() => {
    for (const g of valid)
      stmt.run(g.id, currentSeason(), g.week, g.kickoff, g.status, g.detail, g.awayId, g.homeId, g.awayScore, g.homeScore, g.winner, now);
  });
  return valid.length;
}

export async function syncSeason() {
  let total = 0;
  const errors: string[] = [];
  for (const w of APP_WEEKS) {
    try {
      total += await syncWeek(w);
    } catch (e) {
      errors.push(t.sync.weekFailed(w, (e as Error).message));
    }
    await sleep(PAUSE_MS);
  }
  // Toute la saison régulière en échec = problème réseau ou ESPN : on remonte l'erreur pour réessayer.
  if (errors.length) console.warn(`[sync] ${errors.length} semaine(s) en échec`, errors[0]);
  if (total === 0 && errors.length) throw new Error(errors[0]);
  return total;
}

/** Semaines avec un match en cours ou qui commence dans les 10 minutes. */
function hotWeeks(now: number): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT week FROM games WHERE season = ? AND status IN ('scheduled', 'live')
       AND kickoff <= ? AND kickoff >= ?`
    )
    .all(currentSeason(), now + 10 * 60_000, now - 8 * HOUR) as { week: number }[];
  return rows.map((r) => r.week);
}

/** Semaines « actives » : un match dans les 4 jours passés ou les 8 jours à venir. */
function activeWeeks(now: number): number[] {
  const rows = db
    .prepare('SELECT DISTINCT week FROM games WHERE season = ? AND kickoff BETWEEN ? AND ?')
    .all(currentSeason(), now - 4 * 24 * HOUR, now + 8 * 24 * HOUR) as { week: number }[];
  return rows.map((r) => r.week);
}

let lastFull = 0;
let lastHourly = 0;
let lastFast = 0;
/** Saison de la dernière synchro complète : quand la saison change (1er juin), on resynchronise tout de suite. */
let lastSeason = 0;

/** Pour les tests : comme au démarrage du serveur. */
export function resetSyncClock() {
  lastFull = lastHourly = lastFast = lastSeason = 0;
}

function recordStatus(ok: boolean, message: string) {
  const games = (db.prepare('SELECT COUNT(*) AS n FROM games WHERE season = ?').get(currentSeason()) as { n: number }).n;
  setMeta('sync_status', JSON.stringify({ at: Date.now(), ok, message, games }));
}

export function syncStatus(): SyncStatus {
  const raw = getMeta('sync_status');
  const games = (db.prepare('SELECT COUNT(*) AS n FROM games WHERE season = ?').get(currentSeason()) as { n: number }).n;
  if (!raw) return { at: null, ok: false, message: t.sync.never, games };
  return { ...(JSON.parse(raw) as SyncStatus), games };
}

async function fullSync(now: number) {
  try {
    const teams = await syncTeams();
    const games = await syncSeason();
    lastFull = lastHourly = now;
    lastSeason = currentSeason(now);
    const msg = t.sync.done(teams, games);
    console.log(`[sync] saison ${currentSeason()} : ${msg}`);
    recordStatus(true, msg);
  } catch (e) {
    // Pas de lastFull : on réessaie au prochain passage (chaque minute) au lieu d'attendre 24 h.
    const msg = (e as Error).message;
    console.error(`[sync] échec de la synchro complète : ${msg}`);
    recordStatus(false, msg);
    throw e;
  }
}

/** Un seul passage à la fois : un clic sur « Synchroniser » attend la fin de celui en cours. */
let queue: Promise<unknown> = Promise.resolve();
function exclusive(fn: () => Promise<void>): Promise<void> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Appelé chaque minute : saison complète 1×/jour, semaines actives 1×/h, matchs en cours toutes les 2 min. */
export function syncTick(now = Date.now()) {
  return exclusive(async () => {
    if (now - lastFull >= 24 * HOUR || currentSeason(now) !== lastSeason) return fullSync(now);
    const hot = hotWeeks(now);
    if (hot.length && now - lastFast >= 2 * 60_000) {
      for (const w of hot) await syncWeek(w);
      lastFast = now;
      return;
    }
    if (now - lastHourly >= HOUR) {
      for (const w of activeWeeks(now)) await syncWeek(w);
      lastHourly = now;
    }
  });
}

/** Synchro complète immédiate (bouton admin). */
export function forceSync() {
  return exclusive(() => fullSync(Date.now()));
}
