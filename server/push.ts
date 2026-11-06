import webpush from 'web-push';
import { PUBLIC_URL, currentSeason, t, weekLabel } from './config';
import { db, getMeta, setMeta, startWeek } from './db';
import { standings } from './scoring';
import { bonusLockAt, bonusPhase, bonusPicks, bonusSettings } from './bonus';

/** VAPID keys: taken from the environment, otherwise from the database; generated when first needed. */
let vapid: { publicKey: string; privateKey: string } | null = null;
function vapidKeys() {
  if (vapid) return vapid;
  let publicKey = process.env.VAPID_PUBLIC_KEY || getMeta('vapid_public');
  let privateKey = process.env.VAPID_PRIVATE_KEY || getMeta('vapid_private');
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    setMeta('vapid_public', publicKey);
    setMeta('vapid_private', privateKey);
    console.log('[push] VAPID keys generated and saved to the database');
  }
  // Apple rejects a localhost "subject": in production, the public URL (Cloudflare) does the job.
  const subject = process.env.VAPID_SUBJECT || (PUBLIC_URL.startsWith('https://') ? PUBLIC_URL : 'mailto:prono@example.com');
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapid = { publicKey, privateKey };
  return vapid;
}

export const vapidPublicKey = () => vapidKeys().publicKey;

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
  vapidKeys();
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
      // Expired or uninstalled subscription: delete it.
      if (err?.statusCode === 404 || err?.statusCode === 410) deleteSubscription(s.endpoint);
      else console.warn('[push] failed', err?.statusCode, err?.body ?? err?.message);
    }
  }
  return sent;
}

const alreadySent = (key: string) => !!db.prepare('SELECT 1 FROM sent_notifications WHERE key = ?').get(key);
const markSent = (key: string) =>
  db.prepare('INSERT OR IGNORE INTO sent_notifications (key, sent_at) VALUES (?, ?)').run(key, Date.now());

// Time in the server's time zone (TZ, Europe/Paris in the Docker image): the group's.
const hourFmt = new Intl.DateTimeFormat(t.common.locale, { hour: '2-digit', minute: '2-digit' });

function subscribedPlayers(): { id: number; name: string }[] {
  return db
    .prepare('SELECT DISTINCT p.id, p.name FROM players p JOIN push_subscriptions s ON s.player_id = p.id')
    .all() as { id: number; name: string }[];
}

/** Reminder ~1 h before a kickoff for those who haven't picked yet. */
async function reminders(now: number) {
  const games = db
    .prepare(
      `SELECT g.id, g.kickoff, a.abbr AS away, h.abbr AS home FROM games g
       JOIN teams a ON a.id = g.away_id JOIN teams h ON h.id = g.home_id
       WHERE g.season = ? AND g.week >= ? AND g.status = 'scheduled' AND g.kickoff > ? AND g.kickoff <= ?
       ORDER BY g.kickoff`
    )
    .all(currentSeason(), startWeek(), now + 45 * 60_000, now + 75 * 60_000) as { id: string; kickoff: number; away: string; home: string }[];
  if (!games.length) return;

  for (const p of subscribedPlayers()) {
    const missing = games.filter(
      (g) => !alreadySent(`remind:${p.id}:${g.id}`) && !db.prepare('SELECT 1 FROM picks WHERE player_id = ? AND game_id = ?').get(p.id, g.id)
    );
    if (!missing.length) continue;
    const first = missing[0];
    const matchups = missing.map((g) => `${g.away} @ ${g.home}`);
    await sendToPlayer(p.id, {
      title: t.notifications.reminderTitle(missing.length),
      body: t.notifications.reminderBody(hourFmt.format(first.kickoff), matchups),
      url: '/#/matches',
      tag: `remind-${first.kickoff}`
    });
    for (const g of missing) markSent(`remind:${p.id}:${g.id}`);
  }
}

/** Results once all games of a week are final. */
async function weekResults(now: number) {
  const weeks = db
    .prepare(
      `SELECT week, MAX(kickoff) AS last, SUM(status = 'final') AS finals, COUNT(*) AS total
       FROM games WHERE season = ? AND week >= ? GROUP BY week`
    )
    .all(currentSeason(), startWeek()) as { week: number; last: number; finals: number; total: number }[];

  for (const w of weeks) {
    if (w.finals !== w.total) continue;
    const key = `week:${currentSeason()}:${w.week}`;
    if (alreadySent(key)) continue;
    markSent(key);
    if (w.last < now - 3 * 24 * 3600_000) continue; // old week on first startup: no notification

    const season = standings();
    const weekRows = standings(w.week);
    for (const p of subscribedPlayers()) {
      const me = season.find((r) => r.id === p.id);
      const mine = weekRows.find((r) => r.id === p.id);
      if (!me || !mine) continue;
      await sendToPlayer(p.id, {
        title: t.notifications.weekDoneTitle(weekLabel(w.week, true)),
        body: t.notifications.weekDoneBody(mine.good, w.total, me.rank, me.points),
        url: '/#/standings',
        tag: key
      });
    }
  }
}

/**
 * "Your pick is flipping": in the last quarter (or overtime), when the leading team changes,
 * notify those who picked this game. A tie doesn't count as a change.
 * A comeback in the final seconds may only be seen once the game is already final: it counts too.
 */
async function flips() {
  const games = db
    .prepare(
      `SELECT g.id, g.status, g.detail, g.away_score AS a, g.home_score AS h,
              ta.name AS awayName, ta.abbr AS awayAbbr, th.name AS homeName, th.abbr AS homeAbbr
       FROM games g JOIN teams ta ON ta.id = g.away_id JOIN teams th ON th.id = g.home_id
       WHERE g.season = ? AND g.week >= ? AND g.away_score IS NOT NULL
         AND (g.status = 'live' OR (g.status = 'final' AND EXISTS (SELECT 1 FROM meta WHERE key = 'lead:' || g.id)))`
    )
    .all(currentSeason(), startWeek()) as {
    id: string;
    status: string;
    detail: string | null;
    a: number;
    h: number;
    awayName: string;
    awayAbbr: string;
    homeName: string;
    homeAbbr: string;
  }[];

  for (const g of games) {
    const key = `lead:${g.id}`;
    const prev = getMeta(key);
    const lead = g.a > g.h ? 'away' : g.h > g.a ? 'home' : null;
    const late = g.status === 'final' || t.espn.detail.isLate(g.detail);

    if (lead && prev && lead !== prev && late) {
      const leadName = lead === 'away' ? g.awayName : g.homeName;
      const score = `${g.awayAbbr} ${g.a}–${g.h} ${g.homeAbbr}`;
      const pickers = db
        .prepare(
          `SELECT p.player_id AS id, p.side FROM picks p
           WHERE p.game_id = ? AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.player_id = p.player_id)`
        )
        .all(g.id) as { id: number; side: string }[];
      for (const p of pickers) {
        const mine = p.side === 'away' ? g.awayName : g.homeName;
        const good = p.side === lead;
        const done = g.status === 'final';
        await sendToPlayer(p.id, {
          title: t.notifications.flipTitle(good, done),
          body: t.notifications.flipBody({ done, good, leader: leadName, picked: mine, score, detail: g.detail }),
          url: `/#/match/${g.id}`,
          tag: `flip-${g.id}`
        });
      }
    }

    if (g.status === 'final') db.prepare('DELETE FROM meta WHERE key = ?').run(key);
    else if (lead && lead !== prev) setMeta(key, lead);
  }
}

/** End-of-season bonus: announcement when picks open, then a reminder ~1 h before they close. */
async function bonusNotifications(now: number) {
  if (bonusPhase(now) !== 'open') return;
  const lock = bonusLockAt()!;
  const { points } = bonusSettings();
  const max = points.afc + points.nfc + points.sb;
  const openKey = `bonus-open:${currentSeason()}`;
  if (!alreadySent(openKey)) {
    markSent(openKey);
    for (const p of subscribedPlayers())
      await sendToPlayer(p.id, {
        title: t.notifications.bonusOpenTitle,
        body: t.notifications.bonusOpenBody(max),
        url: '/#/bonus',
        tag: openKey
      });
  }
  if (lock - now > 75 * 60_000 || lock - now < 45 * 60_000) return;
  const done = new Set(bonusPicks().map((b) => b.playerId));
  for (const p of subscribedPlayers()) {
    const key = `bonus-remind:${currentSeason()}:${p.id}`;
    if (done.has(p.id) || alreadySent(key)) continue;
    markSent(key);
    await sendToPlayer(p.id, {
      title: t.notifications.bonusReminderTitle,
      body: t.notifications.bonusReminderBody(max),
      url: '/#/bonus',
      tag: `bonus-remind-${currentSeason()}`
    });
  }
}

export async function notificationsTick(now = Date.now()) {
  await reminders(now);
  await bonusNotifications(now);
  await flips();
  await weekResults(now);
}
