import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_LANG, isLang, messages } from '../shared/i18n';
import path from 'node:path';

const ROOT = process.cwd();

export const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, 'data');
/** SQLite file; ":memory:" for tests. */
export const DB_FILE = process.env.DB_FILE ?? defaultDbFile(DATA_DIR);

/** huddle.db, or prono.db for installs made before the app was renamed (their data stays where it is). */
export function defaultDbFile(dataDir: string): string {
  const legacy = path.join(dataDir, 'prono.db');
  return existsSync(legacy) ? legacy : path.join(dataDir, 'huddle.db');
}

export const WEB_DIR = process.env.WEB_DIR ?? path.join(ROOT, 'dist', 'web');
export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
/**
 * "Secure" session cookie, only sent over HTTPS. On by default when PUBLIC_URL is https (the normal
 * setup, behind a reverse proxy or tunnel); off for a plain-http test on a LAN address, where browsers
 * would otherwise drop the cookie and nobody could log in. COOKIE_SECURE=true|false overrides it.
 */
export const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? String(PUBLIC_URL.startsWith('https://'))) === 'true';

/**
 * Version of this build: "1.2.0" for a release, "1.2.0-edge.abc1234" for a build of main between two
 * releases, "dev" locally. Set by CI (APP_VERSION build arg); shown in the profile and compared by the
 * app to offer a reload when the server is newer.
 */
export const APP_VERSION = process.env.APP_VERSION || 'dev';
export const SYNC_ENABLED = process.env.SYNC !== 'off';

/**
 * Players to create on first start, optional (SEED_FILE): without a file, the app starts empty and
 * the first visitor creates the group from their phone (and becomes its admin).
 */
export interface Seed {
  /** First counted week of the current season (mid-season start). */
  startWeek?: number;
  players: { name: string; startPoints?: number; admin?: boolean }[];
}

const seedPath = process.env.SEED_FILE;
export const seed: Seed | null = seedPath && existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : null;

/**
 * Season shown at a given date. An NFL season runs from September to the Super Bowl in February; it stays
 * shown until the end of May (final standings, recap), then the next one takes over on June 1st,
 * once ESPN has published its schedule: week 1 can already be predicted by then.
 */
export function seasonAt(t: number): number {
  const d = new Date(t);
  return d.getUTCMonth() < 5 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
}

/** Current season, recomputed on every call (the server keeps running from one season to the next). SEASON pins it. */
export function currentSeason(now = Date.now()): number {
  return process.env.SEASON ? Number(process.env.SEASON) : seasonAt(now);
}

/**
 * First counted week of the season in progress at the time of the upgrade to multiple seasons
 * (migration 4) or of the seed players' creation. Later seasons count from week 1.
 */
export const INITIAL_START_WEEK = Number(process.env.START_WEEK ?? seed?.startWeek ?? 1);

// ---------- Instance settings (environment variables) ----------

/** Language of the app and notifications (dictionaries in shared/i18n). Only "fr" exists for now. */
export const APP_LANG = isLang(process.env.APP_LANG) ? process.env.APP_LANG! : DEFAULT_LANG;
/** The instance's texts, in its language. */
export const t = messages(APP_LANG);

/** Displayed name (title, login screen, installed app); the short name goes under the icon. */
export const APP_NAME = process.env.APP_NAME?.trim() || t.common.appName;
export const APP_SHORT_NAME = process.env.APP_SHORT_NAME?.trim() || t.common.appShortName;

/** Scoring: points for a correct pick in the regular season and in the playoffs (Wild Card to Super Bowl). */
export const POINTS_REGULAR = points(process.env.POINTS_REGULAR, 1);
export const POINTS_PLAYOFFS = points(process.env.POINTS_PLAYOFFS, 2);

function points(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : fallback;
}

/** « S9 », « Semaine 9 », « Wild Card »… in the instance's language. */
export function weekLabel(week: number, long = false): string {
  return t.common.weekLabel(week, long);
}
