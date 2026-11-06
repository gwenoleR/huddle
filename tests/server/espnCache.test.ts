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

/** A fake ESPN source returning v1, v2, v3… on each call. */
function source() {
  let n = 0;
  return vi.fn(async () => ({ v: ++n }));
}

describe('ESPN cache', () => {
  it('serves the fresh copy without calling ESPN again', async () => {
    const load = source();
    expect(await cached('k', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    vi.setSystemTime(NOW + 9 * MIN);
    expect(await cached('k', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a single ESPN call when several players request the same thing at once', async () => {
    const load = source();
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => cached('k', load, { ttl: MIN })));
    expect(all).toEqual(Array(5).fill({ v: 1 }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stale without an swr window: waits for the new version', async () => {
    const load = source();
    await cached('k', load, { ttl: MIN });
    vi.setSystemTime(NOW + 2 * MIN);
    expect(await cached('k', load, { ttl: MIN })).toEqual({ v: 2 });
  });

  it('within the swr window: old version right away, new one on the next call', async () => {
    const load = source();
    await cached('k', load, { ttl: MIN, swr: 10 * MIN });
    vi.setSystemTime(NOW + 2 * MIN);
    expect(await cached('k', load, { ttl: MIN, swr: 10 * MIN })).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(2); // refreshed in the background
    await vi.waitFor(async () => expect(await cached('k', load, { ttl: MIN, swr: 10 * MIN })).toEqual({ v: 2 }));
  });

  it('ESPN down: serves the last known version, even a very old one', async () => {
    await cached('k', source(), { ttl: MIN });
    vi.setSystemTime(NOW + 3 * 24 * 60 * MIN);
    const down = vi.fn(async () => {
      throw new Error('ESPN down');
    });
    expect(await cached('k', down, { ttl: MIN })).toEqual({ v: 1 });
  });

  it('ESPN down and nothing cached: the error propagates', async () => {
    await expect(cached('k', async () => Promise.reject(new Error('ESPN down')), { ttl: MIN })).rejects.toThrow('ESPN down');
  });

  it('the ttl can depend on the data', async () => {
    const load = vi.fn(async () => ({ done: true }));
    await cached('k', load, { ttl: (d) => (d.done ? FOREVER : MIN) });
    vi.setSystemTime(NOW + 365 * 24 * 60 * MIN);
    await cached('k', load, { ttl: MIN });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('survives a restart thanks to SQLite, including "forever"', async () => {
    await cached('done', async () => ({ stats: 'game over' }), { ttl: FOREVER });
    await cached('fresh', async () => ({ v: 1 }), { ttl: 10 * MIN });
    expect(db.prepare("SELECT expires FROM espn_cache WHERE key = 'done'").get()).toEqual({ expires: null });

    forgetMemory(); // server restart
    const load = source();
    expect(await cached('done', load, { ttl: MIN })).toEqual({ stats: 'game over' });
    expect(await cached('fresh', load, { ttl: 10 * MIN })).toEqual({ v: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it('a new app version clears the cache (the format may have changed)', async () => {
    resetIfNewVersion('dev'); // server start
    await cached('k', async () => ({ v: 'old format' }), { ttl: FOREVER });
    resetIfNewVersion('dev'); // same version: kept
    expect(await cached('k', async () => ({ v: 'new' }), { ttl: MIN })).toEqual({ v: 'old format' });
    resetIfNewVersion('abc1234'); // the app was updated
    expect(await cached('k', async () => ({ v: 'new' }), { ttl: MIN })).toEqual({ v: 'new' });
  });
});
