/**
 * Pronos des semaines jouées sur l'ancien site (« Prono Entre Amis »), récupérés en CSV :
 * importés une seule fois, ils remplacent les points de départ par le vrai historique.
 *
 * Format : une ligne par match, la semaine en 1re colonne sur le premier match de chaque semaine,
 * puis l'équipe à domicile, l'équipe à l'extérieur et un prono par joueur (« Prono GW », « Prono AU »…,
 * les deux premières lettres du prénom). Une case vide = pas de prono.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SEASON } from './config';
import { db, getMeta, setMeta, transaction } from './db';

export interface HistoryLine {
  week: number;
  home: string;
  away: string;
  /** Initiales du joueur → équipe choisie (nom complet), seulement s'il a pronostiqué. */
  picks: Record<string, string>;
}

/** Une ligne de CSV, avec les guillemets éventuels. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // « "" » dans une cellule entre guillemets = un guillemet.
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

export function parseHistory(text: string): HistoryLine[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = cells(lines[0]);
  const players = header.slice(3).map((h) => h.replace(/^prono\s+/i, '').toUpperCase());
  const out: HistoryLine[] = [];
  let week = 0;
  for (const [i, line] of lines.slice(1).entries()) {
    const c = cells(line);
    const m = /^week\s*(\d+)$/i.exec(c[0]);
    if (m) week = Number(m[1]);
    else if (c[0]) throw new Error(`Ligne ${i + 2} : semaine illisible « ${c[0]} »`);
    if (!week) throw new Error(`Ligne ${i + 2} : match avant la première semaine`);
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
  /** Joueurs dont les points de départ sont remplacés par l'historique. */
  players: string[];
}

/**
 * Importe l'historique, tout ou rien : si un match, une équipe ou un joueur ne colle pas, rien n'est
 * écrit et l'erreur liste tous les problèmes. Les points de départ des joueurs du fichier passent à 0 :
 * leurs points des semaines importées viennent désormais de leurs pronos.
 */
export function importHistory(lines: HistoryLine[]): ImportResult {
  const teams = new Map(
    (db.prepare('SELECT id, display_name FROM teams').all() as { id: string; display_name: string }[]).map((t) => [t.display_name.toLowerCase(), t.id])
  );
  const players = db.prepare('SELECT id, name FROM players').all() as { id: number; name: string }[];
  const byInitials = new Map<string, { id: number; name: string }[]>();
  for (const p of players) {
    const k = p.name.slice(0, 2).toUpperCase();
    byInitials.set(k, [...(byInitials.get(k) ?? []), p]);
  }
  const gameStmt = db.prepare('SELECT id, kickoff, away_id, home_id FROM games WHERE season = ? AND week = ? AND away_id IN (?, ?) AND home_id IN (?, ?)');

  const problems: string[] = [];
  const rows: { playerId: number; gameId: string; side: 'away' | 'home'; at: number }[] = [];
  const seenGames = new Set<string>();
  const usedPlayers = new Map<string, { id: number; name: string }>();

  for (const l of lines) {
    const where = `S${l.week} ${l.away} @ ${l.home}`;
    const home = teams.get(l.home.toLowerCase());
    const away = teams.get(l.away.toLowerCase());
    if (!home || !away) {
      problems.push(`${where} : équipe inconnue`);
      continue;
    }
    const g = gameStmt.get(SEASON, l.week, home, away, home, away) as { id: string; kickoff: number; away_id: string; home_id: string } | undefined;
    if (!g) {
      problems.push(`${where} : match introuvable (synchro pas encore faite ?)`);
      continue;
    }
    if (seenGames.has(g.id)) problems.push(`${where} : match en double`);
    seenGames.add(g.id);
    for (const [initials, pick] of Object.entries(l.picks)) {
      const candidates = byInitials.get(initials) ?? [];
      if (candidates.length !== 1) {
        problems.push(`${where} : joueur « ${initials} » ${candidates.length ? 'ambigu' : 'inconnu'}`);
        continue;
      }
      const team = teams.get(pick.toLowerCase());
      const side = team === g.home_id ? 'home' : team === g.away_id ? 'away' : null;
      if (!side) {
        problems.push(`${where} : prono de ${initials} « ${pick} » ne joue pas ce match`);
        continue;
      }
      usedPlayers.set(initials, candidates[0]);
      // Heure du prono inconnue : la veille du match (pour ne pas fausser le trophée « Sur le fil »).
      rows.push({ playerId: candidates[0].id, gameId: g.id, side, at: g.kickoff - 24 * 3600_000 });
    }
  }
  if (problems.length) throw new Error(`Historique non importé :\n- ${[...new Set(problems)].join('\n- ')}`);

  transaction(() => {
    const ins = db.prepare(
      `INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(player_id, game_id) DO UPDATE SET side = excluded.side, updated_at = excluded.updated_at`
    );
    for (const r of rows) ins.run(r.playerId, r.gameId, r.side, r.at);
    const zero = db.prepare('UPDATE players SET start_points = 0 WHERE id = ?');
    for (const p of usedPlayers.values()) zero.run(p.id);
    setMeta(`history_import:${SEASON}`, JSON.stringify({ at: Date.now(), games: seenGames.size, picks: rows.length }));
  });
  return { games: seenGames.size, picks: rows.length, players: [...usedPlayers.values()].map((p) => p.name) };
}

export const HISTORY_FILE = process.env.HISTORY_FILE ?? path.join(process.cwd(), 'seed', `pronos-${SEASON}.csv`);

let lastProblem = '';

/**
 * Appelé chaque minute : importe le fichier d'historique une seule fois, dès que les matchs
 * correspondants sont en base. Tant que ce n'est pas possible, on réessaie (et on le dit une fois).
 */
export function historyTick(file = HISTORY_FILE): ImportResult | null {
  if (getMeta(`history_import:${SEASON}`) || !existsSync(file)) return null;
  try {
    const result = importHistory(parseHistory(readFileSync(file, 'utf8')));
    console.log(`[historique] ${result.picks} pronos importés sur ${result.games} matchs (${result.players.join(', ')})`);
    return result;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg !== lastProblem) console.warn(`[historique] ${msg}`);
    lastProblem = msg;
    return null;
  }
}
