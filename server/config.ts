import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

export const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, 'data');
/** Fichier SQLite ; « :memory: » pour les tests. */
export const DB_FILE = process.env.DB_FILE ?? path.join(DATA_DIR, 'prono.db');
export const WEB_DIR = process.env.WEB_DIR ?? path.join(ROOT, 'dist', 'web');
export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
export const IS_PROD = process.env.NODE_ENV === 'production';
/** Cookie « Secure » : vrai derrière Cloudflare (HTTPS). Les navigateurs l'acceptent aussi sur http://localhost. */
export const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? (IS_PROD ? 'true' : 'false')) === 'true';
export const SYNC_ENABLED = process.env.SYNC !== 'off';

export interface Seed {
  saison: number;
  semaineDeReprise: number;
  joueurs: { prenom: string; pointsDeDepart: number; admin?: boolean }[];
}

const seedPath = process.env.SEED_FILE ?? path.join(ROOT, 'seed', 'joueurs.json');
export const seed: Seed = JSON.parse(readFileSync(seedPath, 'utf8'));

export const SEASON = Number(process.env.SEASON ?? seed.saison);
/** Première semaine dont les pronos comptent dans l'appli (avant : points repris de l'ancien site). */
export const START_WEEK = Number(process.env.START_WEEK ?? seed.semaineDeReprise);

/** Semaines de l'appli : 1 à 18 = saison régulière, puis 19 Wild Card, 20 Div., 21 Conf., 22 Super Bowl. */
export const WEEK_LABELS: Record<number, { short: string; long: string }> = {
  19: { short: 'Wild Card', long: 'Wild Card' },
  20: { short: 'Div.', long: 'Tour de division' },
  21: { short: 'Conf.', long: 'Finales de conférence' },
  22: { short: 'Super Bowl', long: 'Super Bowl' }
};

export function weekLabel(week: number, long = false): string {
  const w = WEEK_LABELS[week];
  if (w) return long ? w.long : w.short;
  return long ? `Semaine ${week}` : `S${week}`;
}
