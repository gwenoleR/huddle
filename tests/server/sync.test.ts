/**
 * Synchro ESPN → base : c'est elle qui fait entrer les matchs, scores et statuts.
 * ESPN est remplacé par une doublure : on choisit ce qu'il « répond » semaine par semaine.
 */
import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EspnGame, EspnTeam } from '../../server/espn';

vi.mock('../../server/espn', async (orig) => ({
  ...(await orig<typeof import('../../server/espn')>()),
  fetchTeams: vi.fn(),
  fetchWeek: vi.fn()
}));
const espn = await import('../../server/espn');
const sync = await import('../../server/sync');
const { DAY, HOUR, NOW, TEAMS, addGame, db, resetDb } = await import('./helpers');

const MIN = 60_000;
const fetchTeams = vi.mocked(espn.fetchTeams);
const fetchWeek = vi.mocked(espn.fetchWeek);

const team = (abbr: keyof typeof TEAMS): EspnTeam => ({
  id: TEAMS[abbr].id,
  abbr,
  name: TEAMS[abbr].name,
  displayName: `${abbr} ${TEAMS[abbr].name}`,
  color: '112233',
  altColor: 'ffffff'
});
const espnGame = (o: Partial<EspnGame> = {}): EspnGame => ({
  id: 'e1',
  week: 10,
  kickoff: NOW + DAY,
  status: 'scheduled',
  detail: null,
  awayId: TEAMS.BUF.id,
  homeId: TEAMS.KC.id,
  awayScore: null,
  homeScore: null,
  winner: null,
  ...o
});
const row = (id: string) => db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
/** Semaines demandées à ESPN depuis le dernier appel. */
const weeksAsked = () => {
  const w = fetchWeek.mock.calls.map(([, week]) => week);
  fetchWeek.mockClear();
  return w;
};

/** Les logos : 404, pour ne rien écrire sur le disque (sauf dans le test qui s'y intéresse). */
const logoFetch = vi.fn(async () => new Response(null, { status: 404 }));

beforeEach(() => {
  resetDb();
  sync.resetSyncClock();
  fetchTeams.mockReset().mockResolvedValue(Object.keys(TEAMS).map((a) => team(a as keyof typeof TEAMS)));
  fetchWeek.mockReset().mockResolvedValue([]);
  logoFetch.mockClear();
  vi.stubGlobal('fetch', logoFetch);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('matchs d’une semaine', () => {
  it('ajoute les matchs puis met à jour score et statut au passage suivant', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    expect(await sync.syncWeek(10)).toBe(1);
    expect(row('e1')).toMatchObject({ season: 2026, week: 10, status: 'scheduled', away_score: null, winner: null });

    fetchWeek.mockResolvedValue([espnGame({ status: 'final', detail: 'Terminé', awayScore: 27, homeScore: 24, winner: 'away' })]);
    await sync.syncWeek(10);
    expect(row('e1')).toMatchObject({ status: 'final', detail: 'Terminé', away_score: 27, home_score: 24, winner: 'away' });
    expect((db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number }).n).toBe(1);
  });

  it('suit un match reprogrammé (nouvelle date, nouvelle semaine)', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    await sync.syncWeek(10);
    fetchWeek.mockResolvedValue([espnGame({ week: 12, kickoff: NOW + 15 * DAY })]);
    await sync.syncWeek(12);
    expect(row('e1')).toMatchObject({ week: 12, kickoff: NOW + 15 * DAY });
  });

  it('ignore un match dont une équipe est inconnue (ex. Pro Bowl AFC/NFC)', async () => {
    fetchWeek.mockResolvedValue([espnGame(), espnGame({ id: 'probowl', awayId: '31', homeId: '32' })]);
    expect(await sync.syncWeek(10)).toBe(1);
    expect(row('probowl')).toBeUndefined();
  });

  it('garde les pronos quand le match est mis à jour', async () => {
    fetchWeek.mockResolvedValue([espnGame()]);
    await sync.syncWeek(10);
    db.prepare("INSERT INTO picks (player_id, game_id, side, updated_at) VALUES (1, 'e1', 'away', 0)").run();
    fetchWeek.mockResolvedValue([espnGame({ status: 'live', awayScore: 7, homeScore: 0 })]);
    await sync.syncWeek(10);
    expect(db.prepare("SELECT side FROM picks WHERE game_id = 'e1'").get()).toEqual({ side: 'away' });
  });
});

describe('équipes et logos', () => {
  it('met à jour les équipes et ne télécharge que les logos manquants', async () => {
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
    fetchTeams.mockResolvedValue([{ ...team('BUF'), color: 'abcdef' }]);
    logoFetch.mockImplementation(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }));
    expect(await sync.syncTeams()).toBe(1);
    expect(db.prepare("SELECT color FROM teams WHERE abbr = 'BUF'").get()).toEqual({ color: 'abcdef' });
    expect(logoFetch).toHaveBeenCalledTimes(2); // clair et sombre

    logoFetch.mockClear();
    await sync.syncTeams();
    expect(logoFetch).not.toHaveBeenCalled();
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
  });

  it('un logo indisponible n’empêche pas la synchro', async () => {
    rmSync(sync.LOGO_DIR, { recursive: true, force: true });
    fetchTeams.mockResolvedValue([team('KC')]);
    logoFetch.mockRejectedValue(new Error('réseau'));
    await expect(sync.syncTeams()).resolves.toBe(1);
  });
});

describe('saison complète', () => {
  it('demande les 22 semaines (saison régulière et playoffs)', async () => {
    await sync.syncSeason();
    expect(weeksAsked()).toEqual([...Array.from({ length: 18 }, (_, i) => i + 1), 19, 20, 21, 22]);
  });

  it('quelques semaines en échec : on garde le reste', async () => {
    fetchWeek.mockImplementation(async (_s, w) => {
      if (w === 3) throw new Error('ESPN a répondu 500');
      return w === 10 ? [espnGame()] : [];
    });
    expect(await sync.syncSeason()).toBe(1);
  });

  it('tout en échec : l’erreur remonte (pour réessayer)', async () => {
    fetchWeek.mockRejectedValue(new Error('ESPN injoignable'));
    await expect(sync.syncSeason()).rejects.toThrow('ESPN injoignable');
  });
});

describe('rythme de la synchro (appelée chaque minute)', () => {
  it('au démarrage : synchro complète, puis rien tant qu’aucun match n’approche', async () => {
    await sync.syncTick(NOW);
    expect(fetchTeams).toHaveBeenCalledTimes(1);
    expect(weeksAsked()).toHaveLength(22);
    expect(sync.syncStatus()).toMatchObject({ ok: true, message: '8 équipes, 0 matchs' });

    await sync.syncTick(NOW + MIN);
    await sync.syncTick(NOW + 30 * MIN);
    expect(fetchTeams).toHaveBeenCalledTimes(1);
    expect(weeksAsked()).toEqual([]);
  });

  it('nouvelle saison (1er juin) : synchro complète tout de suite, sans attendre le lendemain', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    process.env.SEASON = '2027';
    try {
      await sync.syncTick(NOW + MIN);
      expect(new Set(fetchWeek.mock.calls.map(([season]) => season))).toEqual(new Set([2027]));
      expect(weeksAsked()).toHaveLength(22);
      await sync.syncTick(NOW + 2 * MIN);
      expect(weeksAsked()).toEqual([]);
    } finally {
      process.env.SEASON = '2026';
    }
  });

  it('pendant les matchs : la semaine en cours toutes les 2 minutes', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 10, kickoff: NOW - HOUR, status: 'live', score: [7, 0] });
    addGame({ week: 11, kickoff: NOW + 7 * DAY });

    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([10]);
    await sync.syncTick(NOW + 3 * MIN);
    expect(weeksAsked()).toEqual([]);
    await sync.syncTick(NOW + 4 * MIN);
    expect(weeksAsked()).toEqual([10]);
  });

  it('un match qui commence dans 10 minutes est déjà suivi de près', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 10, kickoff: NOW + 12 * MIN });
    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([10]);
  });

  it('un match « en cours » depuis plus de 8 h n’est plus suivi de près', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 9, kickoff: NOW - 9 * HOUR, status: 'live', score: [7, 0] });
    await sync.syncTick(NOW + 2 * MIN);
    expect(weeksAsked()).toEqual([]);
  });

  it('chaque heure : les semaines avec un match dans les 4 jours passés ou 8 jours à venir', async () => {
    await sync.syncTick(NOW);
    weeksAsked();
    addGame({ week: 9, kickoff: NOW - 3 * DAY, score: [1, 0] });
    addGame({ week: 10, kickoff: NOW + 2 * DAY });
    addGame({ week: 8, kickoff: NOW - 10 * DAY, score: [1, 0] });
    addGame({ week: 12, kickoff: NOW + 15 * DAY });

    await sync.syncTick(NOW + 59 * MIN);
    expect(weeksAsked()).toEqual([]);
    await sync.syncTick(NOW + HOUR);
    expect(weeksAsked().sort()).toEqual([10, 9].sort());
  });

  it('une fois par jour : de nouveau la saison complète', async () => {
    await sync.syncTick(NOW);
    await sync.syncTick(NOW + 24 * HOUR);
    expect(fetchTeams).toHaveBeenCalledTimes(2);
  });

  it('synchro complète ratée : on réessaie à la minute suivante, pas le lendemain', async () => {
    fetchTeams.mockRejectedValueOnce(new Error('ESPN injoignable (ENOTFOUND)'));
    await expect(sync.syncTick(NOW)).rejects.toThrow('ENOTFOUND');
    expect(sync.syncStatus()).toMatchObject({ ok: false, message: 'ESPN injoignable (ENOTFOUND)' });

    await sync.syncTick(NOW + MIN);
    expect(fetchTeams).toHaveBeenCalledTimes(2);
    expect(sync.syncStatus().ok).toBe(true);
  });
});

describe('bouton « Synchroniser maintenant »', () => {
  it('attend la fin de la synchro en cours au lieu de la doubler', async () => {
    let running = 0;
    let overlap = false;
    fetchTeams.mockImplementation(async () => {
      running++;
      if (running > 1) overlap = true;
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return [team('BUF')];
    });
    await Promise.all([sync.syncTick(NOW), sync.forceSync(), sync.forceSync()]);
    expect(fetchTeams).toHaveBeenCalledTimes(3);
    expect(overlap).toBe(false);
  });

  it('une erreur n’empêche pas les synchros suivantes', async () => {
    fetchTeams.mockRejectedValueOnce(new Error('panne'));
    await expect(sync.forceSync()).rejects.toThrow('panne');
    await expect(sync.forceSync()).resolves.toBeUndefined();
  });

  it('état affiché à l’admin avant toute synchro', () => {
    expect(sync.syncStatus()).toEqual({ at: null, ok: false, message: 'Pas encore de synchro', games: 0 });
  });
});
