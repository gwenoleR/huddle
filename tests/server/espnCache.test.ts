import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOREVER, cached, clearEspnCache, forgetMemory, resetIfNewVersion } from '../../server/espnCache';
import { db } from '../../server/db';

const NOW = Date.parse('2026-11-08T18:00:00Z');
const MIN = 60_000;

beforeEach(() => {
  clearEspnCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/** Une fausse source ESPN qui renvoie v1, v2, v3… à chaque appel. */
function source() {
  let n = 0;
  return vi.fn(async () => ({ v: ++n }));
}

describe('cache ESPN', () => {
  it('sert la copie fraîche sans rappeler ESPN', async () => {
    const load = source();
    expect(await cached('k', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    vi.setSystemTime(NOW + 9 * MIN);
    expect(await cached('k', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('un seul appel ESPN quand plusieurs joueurs demandent la même chose en même temps', async () => {
    const load = source();
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => cached('k', load, { ttl: MIN })));
    expect(all).toEqual(Array(5).fill({ v: 1 }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('périmée sans fenêtre swr : on attend la nouvelle version', async () => {
    const load = source();
    await cached('k', load, { ttl: MIN });
    vi.setSystemTime(NOW + 2 * MIN);
    expect(await cached('k', load, { ttl: MIN })).toEqual({ v: 2 });
  });

  it('dans la fenêtre swr : ancienne version tout de suite, nouvelle au passage suivant', async () => {
    const load = source();
    await cached('k', load, { ttl: MIN, swr: 10 * MIN });
    vi.setSystemTime(NOW + 2 * MIN);
    expect(await cached('k', load, { ttl: MIN, swr: 10 * MIN })).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(2); // rafraîchie en arrière-plan
    await vi.waitFor(async () => expect(await cached('k', load, { ttl: MIN, swr: 10 * MIN })).toEqual({ v: 2 }));
  });

  it('ESPN en panne : on ressert la dernière version connue, même très vieille', async () => {
    await cached('k', source(), { ttl: MIN });
    vi.setSystemTime(NOW + 3 * 24 * 60 * MIN);
    const down = vi.fn(async () => {
      throw new Error('ESPN en panne');
    });
    expect(await cached('k', down, { ttl: MIN })).toEqual({ v: 1 });
  });

  it('ESPN en panne et rien en cache : l’erreur remonte', async () => {
    await expect(cached('k', async () => Promise.reject(new Error('ESPN en panne')), { ttl: MIN })).rejects.toThrow('ESPN en panne');
  });

  it('la durée de vie peut dépendre de la donnée', async () => {
    const load = vi.fn(async () => ({ done: true }));
    await cached('k', load, { ttl: (d) => (d.done ? FOREVER : MIN) });
    vi.setSystemTime(NOW + 365 * 24 * 60 * MIN);
    await cached('k', load, { ttl: MIN });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('survit à un redémarrage grâce à SQLite, y compris « pour toujours »', async () => {
    await cached('fini', async () => ({ stats: 'match terminé' }), { ttl: FOREVER });
    await cached('frais', async () => ({ v: 1 }), { ttl: 10 * MIN });
    expect(db.prepare("SELECT expires FROM espn_cache WHERE key = 'fini'").get()).toEqual({ expires: null });

    forgetMemory(); // redémarrage du serveur
    const load = source();
    expect(await cached('fini', load, { ttl: MIN })).toEqual({ stats: 'match terminé' });
    expect(await cached('frais', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it('une nouvelle version de l’appli vide le cache (le format a pu changer)', async () => {
    resetIfNewVersion('dev'); // démarrage du serveur
    await cached('k', async () => ({ v: 'ancien format' }), { ttl: FOREVER });
    resetIfNewVersion('dev'); // même version : on garde
    expect(await cached('k', async () => ({ v: 'nouveau' }), { ttl: MIN })).toEqual({ v: 'ancien format' });
    resetIfNewVersion('abc1234'); // l'appli a été mise à jour
    expect(await cached('k', async () => ({ v: 'nouveau' }), { ttl: MIN })).toEqual({ v: 'nouveau' });
  });
});
