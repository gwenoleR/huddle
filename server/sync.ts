import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, SEASON } from './config';
import { db, transaction } from './db';
import { APP_WEEKS, fetchTeams, fetchWeek, logoUrl, type EspnGame } from './espn';

const LOGO_DIR = path.join(DATA_DIR, 'logos');
export { LOGO_DIR };

const HOUR = 60 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const games = await fetchWeek(SEASON, week);
  const known = new Set((db.prepare('SELECT id FROM teams').all() as { id: string }[]).map((r) => r.id));
  const valid = games.filter((g: EspnGame) => known.has(g.awayId) && known.has(g.homeId));
  const stmt = upsertGame();
  const now = Date.now();
  transaction(() => {
    for (const g of valid)
      stmt.run(g.id, SEASON, g.week, g.kickoff, g.status, g.detail, g.awayId, g.homeId, g.awayScore, g.homeScore, g.winner, now);
  });
  return valid.length;
}

export async function syncSeason() {
  let total = 0;
  for (const w of APP_WEEKS) {
    try {
      total += await syncWeek(w);
    } catch (e) {
      console.warn(`[sync] semaine ${w} :`, (e as Error).message);
    }
    await sleep(300);
  }
  return total;
}

/** Semaines avec un match en cours ou qui commence dans les 10 minutes. */
function hotWeeks(now: number): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT week FROM games WHERE season = ? AND status IN ('scheduled', 'live')
       AND kickoff <= ? AND kickoff >= ?`
    )
    .all(SEASON, now + 10 * 60_000, now - 8 * HOUR) as { week: number }[];
  return rows.map((r) => r.week);
}

/** Semaines « actives » : un match dans les 4 jours passés ou les 8 jours à venir. */
function activeWeeks(now: number): number[] {
  const rows = db
    .prepare('SELECT DISTINCT week FROM games WHERE season = ? AND kickoff BETWEEN ? AND ?')
    .all(SEASON, now - 4 * 24 * HOUR, now + 8 * 24 * HOUR) as { week: number }[];
  return rows.map((r) => r.week);
}

let lastFull = 0;
let lastHourly = 0;
let lastFast = 0;

/** Appelé chaque minute : saison complète 1×/jour, semaines actives 1×/h, matchs en cours toutes les 2 min. */
export async function syncTick(now = Date.now()) {
  if (now - lastFull >= 24 * HOUR) {
    const teams = await syncTeams();
    const games = await syncSeason();
    lastFull = lastHourly = now;
    console.log(`[sync] saison ${SEASON} : ${teams} équipes, ${games} matchs`);
    return;
  }
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
}
