import { existsSync, readFileSync } from 'node:fs';
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

/**
 * Joueurs à créer au premier démarrage, optionnel (SEED_FILE) : sans fichier, l'appli démarre vide et
 * le premier venu crée le groupe depuis son téléphone (il en devient l'admin).
 */
export interface Seed {
  semaineDeReprise?: number;
  joueurs: { prenom: string; pointsDeDepart: number; admin?: boolean }[];
}

const seedPath = process.env.SEED_FILE;
export const seed: Seed | null = seedPath && existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : null;

/**
 * Saison affichée à une date. Une saison NFL va de septembre au Super Bowl de février ; elle reste
 * affichée jusqu'à fin mai (classement final, bilan), puis la suivante prend le relais le 1er juin,
 * quand ESPN a publié son calendrier : on peut alors déjà pronostiquer la semaine 1.
 */
export function seasonAt(t: number): number {
  const d = new Date(t);
  return d.getUTCMonth() < 5 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
}

/** Saison en cours, recalculée à chaque appel (le serveur tourne d'une saison à l'autre). SEASON la fige. */
export function currentSeason(now = Date.now()): number {
  return process.env.SEASON ? Number(process.env.SEASON) : seasonAt(now);
}

/**
 * Première semaine comptée pour la saison en cours au moment de la mise à jour vers plusieurs saisons
 * (migration 4) ou de la création des joueurs du seed. Les saisons suivantes comptent dès la semaine 1.
 */
export const INITIAL_START_WEEK = Number(process.env.START_WEEK ?? seed?.semaineDeReprise ?? 1);

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
