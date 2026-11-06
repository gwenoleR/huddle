/**
 * Picks for weeks played elsewhere (an old site, a spreadsheet…), uploaded as CSV by the admin:
 * they replace the starting points with the real history.
 *
 * Format: one line per game, the week in the 1st column on the first game of each week,
 * then the home team, the away team and one pick per player ("Prono GW", "Prono AU"…,
 * the first two letters of the first name). An empty cell = no pick.
 */
import { currentSeason, t } from './config';
import { db, setMeta, setStartPoints, transaction } from './db';

export interface HistoryLine {
  week: number;
  home: string;
  away: string;
  /** Player initials → chosen team (full name), only if they made a pick. */
  picks: Record<string, string>;
}

/** Initials ignoring accents and case: "Léa" and "Prono LE" match. */
export const initials = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 2).toUpperCase();

/** One CSV line, with optional quotes. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // '""' inside a quoted cell = one quote.
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses the CSV; the week ("Week1") is only written on the first game of each week. */
export function parseHistory(text: string): HistoryLine[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error(t.history.emptyFile);
  const header = cells(lines[0]);
  const players = header.slice(3).map((h) => initials(h.replace(/^prono\s+/i, '')));
  const out: HistoryLine[] = [];
  let week = 0;
  for (const [i, line] of lines.slice(1).entries()) {
    const c = cells(line);
    const m = /^week\s*(\d+)$/i.exec(c[0]);
    if (m) week = Number(m[1]);
    else if (c[0]) throw new Error(t.history.unreadableWeek(i + 2, c[0]));
    if (!week) throw new Error(t.history.gameBeforeFirstWeek(i + 2));
    const picks: Record<string, string> = {};
    players.forEach((p, j) => {
      if (c[3 + j]) picks[p] = c[3 + j];
    });
    out.push({ week, home: c[1], away: c[2], picks });
  }
  return out;
}

export interface ImportResult {
  games: number;
  picks: number;
  /** Players whose starting points are replaced by the history. */
  players: string[];
}

/**
 * Imports the history, all or nothing: if a game, team or player doesn't match, nothing is
 * written and the error lists every problem. Starting points of the players in the file are set to 0:
 * their points for the imported weeks now come from their picks.
 * With dryRun, everything is checked but nothing is written: the admin sees what will be imported.
 */
export function importHistory(lines: HistoryLine[], { dryRun = false } = {}): ImportResult {
  const teams = new Map(
    (db.prepare('SELECT id, display_name FROM teams').all() as { id: string; display_name: string }[]).map((t) => [t.display_name.toLowerCase(), t.id])
  );
  const players = db.prepare('SELECT id, name FROM players').all() as { id: number; name: string }[];
  const byInitials = new Map<string, { id: number; name: string }[]>();
  for (const p of players) {
    const k = initials(p.name);
    byInitials.set(k, [...(byInitials.get(k) ?? []), p]);
  }
  const gameStmt = db.prepare('SELECT id, kickoff, away_id, home_id FROM games WHERE season = ? AND week = ? AND away_id IN (?, ?) AND home_id IN (?, ?)');

  const problems: string[] = [];
  const rows: { playerId: number; gameId: string; side: 'away' | 'home'; at: number }[] = [];
  const seenGames = new Set<string>();
  const usedPlayers = new Map<string, { id: number; name: string }>();

  for (const l of lines) {
    const where = t.history.where(l.week, l.away, l.home);
    const home = teams.get(l.home.toLowerCase());
    const away = teams.get(l.away.toLowerCase());
    if (!home || !away) {
      problems.push(t.history.unknownTeam(where));
      continue;
    }
    const g = gameStmt.get(currentSeason(), l.week, home, away, home, away) as { id: string; kickoff: number; away_id: string; home_id: string } | undefined;
    if (!g) {
      problems.push(t.history.gameNotFound(where));
      continue;
    }
    if (seenGames.has(g.id)) problems.push(t.history.duplicateGame(where));
    seenGames.add(g.id);
    for (const [who, pick] of Object.entries(l.picks)) {
      const candidates = byInitials.get(who) ?? [];
      if (candidates.length !== 1) {
        // Once per column, not for every game.
        problems.push(
          candidates.length
            ? t.history.ambiguousPlayer(who, candidates.map((c) => c.name))
            : t.history.unknownPlayer(who)
        );
        continue;
      }
      const team = teams.get(pick.toLowerCase());
      const side = team === g.home_id ? 'home' : team === g.away_id ? 'away' : null;
      if (!side) {
        problems.push(t.history.pickNotInGame(where, who, pick));
        continue;
      }
      usedPlayers.set(who, candidates[0]);
      // Pick time unknown: the day before the game (so as not to skew the « Sur le fil » trophy).
      rows.push({ playerId: candidates[0].id, gameId: g.id, side, at: g.kickoff - 24 * 3600_000 });
    }
  }
  if (problems.length) throw new Error(t.history.notImported([...new Set(problems)]));
  const result = { games: seenGames.size, picks: rows.length, players: [...usedPlayers.values()].map((p) => p.name) };
  if (dryRun) return result;

  transaction(() => {
    const ins = db.prepare(
      `INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(player_id, game_id) DO UPDATE SET side = excluded.side, updated_at = excluded.updated_at`
    );
    for (const r of rows) ins.run(r.playerId, r.gameId, r.side, r.at);
    for (const p of usedPlayers.values()) setStartPoints(p.id, 0);
    setMeta(`history_import:${currentSeason()}`, JSON.stringify({ at: Date.now(), games: seenGames.size, picks: rows.length }));
  });
  return result;
}
