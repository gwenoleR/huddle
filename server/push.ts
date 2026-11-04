import webpush from 'web-push';
import { PUBLIC_URL, SEASON, START_WEEK, weekLabel } from './config';
import { db, getMeta, setMeta } from './db';
import { standings } from './scoring';

let publicKey = process.env.VAPID_PUBLIC_KEY || getMeta('vapid_public');
let privateKey = process.env.VAPID_PRIVATE_KEY || getMeta('vapid_private');
if (!publicKey || !privateKey) {
  const keys = webpush.generateVAPIDKeys();
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
  setMeta('vapid_public', publicKey);
  setMeta('vapid_private', privateKey);
  console.log('[push] clés VAPID générées et enregistrées en base');
}

// Apple refuse un « subject » en localhost : en prod, l'URL publique (Cloudflare) fait l'affaire.
const subject = process.env.VAPID_SUBJECT || (PUBLIC_URL.startsWith('https://') ? PUBLIC_URL : 'mailto:prono@example.com');
webpush.setVapidDetails(subject, publicKey, privateKey);

export const vapidPublicKey = publicKey;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function saveSubscription(playerId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(sub.endpoint, playerId, sub.keys.p256dh, sub.keys.auth, Date.now());
}

export function deleteSubscription(endpoint: string) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

export async function sendToPlayer(playerId: number, payload: PushPayload): Promise<number> {
  const subs = db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE player_id = ?')
    .all(playerId) as { endpoint: string; p256dh: string; auth: string }[];
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 3600
      });
      sent++;
    } catch (err: any) {
      // Abonnement expiré ou désinstallé : on le supprime.
      if (err?.statusCode === 404 || err?.statusCode === 410) deleteSubscription(s.endpoint);
      else console.warn('[push] échec', err?.statusCode, err?.body ?? err?.message);
    }
  }
  return sent;
}

const alreadySent = (key: string) => !!db.prepare('SELECT 1 FROM sent_notifications WHERE key = ?').get(key);
const markSent = (key: string) =>
  db.prepare('INSERT OR IGNORE INTO sent_notifications (key, sent_at) VALUES (?, ?)').run(key, Date.now());

const hourFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });

function subscribedPlayers(): { id: number; name: string }[] {
  return db
    .prepare('SELECT DISTINCT p.id, p.name FROM players p JOIN push_subscriptions s ON s.player_id = p.id')
    .all() as { id: number; name: string }[];
}

/** Rappel ~1 h avant un coup d'envoi pour ceux qui n'ont pas encore pronostiqué. */
async function reminders(now: number) {
  const games = db
    .prepare(
      `SELECT g.id, g.kickoff, a.abbr AS away, h.abbr AS home FROM games g
       JOIN teams a ON a.id = g.away_id JOIN teams h ON h.id = g.home_id
       WHERE g.season = ? AND g.week >= ? AND g.status = 'scheduled' AND g.kickoff > ? AND g.kickoff <= ?
       ORDER BY g.kickoff`
    )
    .all(SEASON, START_WEEK, now + 45 * 60_000, now + 75 * 60_000) as { id: string; kickoff: number; away: string; home: string }[];
  if (!games.length) return;

  for (const p of subscribedPlayers()) {
    const missing = games.filter(
      (g) => !alreadySent(`remind:${p.id}:${g.id}`) && !db.prepare('SELECT 1 FROM picks WHERE player_id = ? AND game_id = ?').get(p.id, g.id)
    );
    if (!missing.length) continue;
    const first = missing[0];
    const matchs = missing.map((g) => `${g.away} @ ${g.home}`).join(', ');
    await sendToPlayer(p.id, {
      title: missing.length > 1 ? `Il te manque ${missing.length} pronos` : 'Il te manque un prono',
      body: `Coup d'envoi à ${hourFmt.format(first.kickoff)} : ${matchs}`,
      url: '/#/matchs',
      tag: `remind-${first.kickoff}`
    });
    for (const g of missing) markSent(`remind:${p.id}:${g.id}`);
  }
}

/** Résultats quand tous les matchs d'une semaine sont terminés. */
async function weekResults(now: number) {
  const weeks = db
    .prepare(
      `SELECT week, MAX(kickoff) AS last, SUM(status = 'final') AS finals, COUNT(*) AS total
       FROM games WHERE season = ? AND week >= ? GROUP BY week`
    )
    .all(SEASON, START_WEEK) as { week: number; last: number; finals: number; total: number }[];

  for (const w of weeks) {
    if (w.finals !== w.total) continue;
    const key = `week:${SEASON}:${w.week}`;
    if (alreadySent(key)) continue;
    markSent(key);
    if (w.last < now - 3 * 24 * 3600_000) continue; // vieille semaine au premier démarrage : pas de notif

    const season = standings();
    const weekRows = standings(w.week);
    for (const p of subscribedPlayers()) {
      const me = season.find((r) => r.id === p.id);
      const mine = weekRows.find((r) => r.id === p.id);
      if (!me || !mine) continue;
      await sendToPlayer(p.id, {
        title: `${weekLabel(w.week, true)} terminée`,
        body: `Tu as fait ${mine.good} sur ${w.total}. Tu es ${me.rank === 1 ? '1er' : `${me.rank}e`} avec ${me.points} pts.`,
        url: '/#/classement',
        tag: key
      });
    }
  }
}

export async function notificationsTick(now = Date.now()) {
  await reminders(now);
  await weekResults(now);
}
