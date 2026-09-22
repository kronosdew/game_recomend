import { describe, it, expect, vi, afterEach } from 'vitest';
import { openDb, getGameMetaByIds, upsertGameMeta } from './db';
import { selectRelevantOwnedGames, loadOwnedGamesMeta } from './owned-games-meta';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';
import { MIN_PLAYTIME_MINUTES, OWNED_GAMES_META_CAP } from '@/lib/recommend/constants';

function game(over: Partial<OwnedGame> = {}): OwnedGame {
  return { appid: 1, name: 'G', playtime_forever: 600, ...over };
}

function meta(over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid: 1, name: 'G', tags: new Map([['A', 1]]), genres: [],
    releaseDate: '2020-01-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

function spyFetch(handler: (appid: number) => {
  tags?: Record<string, number>; positive?: number; negative?: number; owners?: string;
} | null) {
  return vi.fn(async (url: string) => {
    const appid = Number(new URL(url).searchParams.get('appid'));
    const body = handler(appid);
    if (body === null) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, json: async () => body };
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('selectRelevantOwnedGames', () => {
  it('MIN_PLAYTIME_MINUTES altındakileri eler', () => {
    const games = [game({ appid: 1, playtime_forever: MIN_PLAYTIME_MINUTES - 1 })];
    expect(selectRelevantOwnedGames(games)).toEqual([]);
  });

  it('MIN_PLAYTIME_MINUTES eşiğini dahil eder (>=)', () => {
    const games = [game({ appid: 1, playtime_forever: MIN_PLAYTIME_MINUTES })];
    expect(selectRelevantOwnedGames(games)).toHaveLength(1);
  });

  it('oynama süresine göre azalan sırada döner', () => {
    const games = [
      game({ appid: 1, playtime_forever: 100 }),
      game({ appid: 2, playtime_forever: 500 }),
      game({ appid: 3, playtime_forever: 300 }),
    ];
    expect(selectRelevantOwnedGames(games).map((g) => g.appid)).toEqual([2, 3, 1]);
  });

  it(`en fazla ${OWNED_GAMES_META_CAP} oyunla sınırlar (R4)`, () => {
    const games = Array.from({ length: OWNED_GAMES_META_CAP + 1 }, (_, i) =>
      game({ appid: i + 1, playtime_forever: (i + 1) * 10 + MIN_PLAYTIME_MINUTES }));
    const out = selectRelevantOwnedGames(games);
    expect(out).toHaveLength(OWNED_GAMES_META_CAP);
    // En düşük oynama süreli (appid 1) sınırın dışında kalmalı.
    expect(out.map((g) => g.appid)).not.toContain(1);
  });

  it(`tam ${OWNED_GAMES_META_CAP} oyun sınırı aşmaz (sınır dahil)`, () => {
    const games = Array.from({ length: OWNED_GAMES_META_CAP }, (_, i) =>
      game({ appid: i + 1, playtime_forever: (i + 1) * 10 + MIN_PLAYTIME_MINUTES }));
    expect(selectRelevantOwnedGames(games)).toHaveLength(OWNED_GAMES_META_CAP);
  });
});

describe('loadOwnedGamesMeta', () => {
  it('önbellekte olan oyun için SteamSpy hiç çağrılmaz', async () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 1, name: 'Cached' }));
    const fetchImpl = spyFetch(() => ({ tags: { X: 1 }, positive: 1, negative: 0, owners: '0' }));

    const result = await loadOwnedGamesMeta(
      db, [game({ appid: 1, playtime_forever: 600 })], fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.get(1)?.name).toBe('Cached');
  });

  it('önbellekte olmayan oyun için SteamSpy çağrılır ve sonuç önbelleğe yazılır', async () => {
    const db = openDb(':memory:');
    const fetchImpl = spyFetch(() => ({ tags: { X: 1 }, positive: 8, negative: 2, owners: '100' }));

    const result = await loadOwnedGamesMeta(
      db, [game({ appid: 2, name: 'Yeni', playtime_forever: 600 })], fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.get(2)?.tags.get('X')).toBeCloseTo(1);
    // Bir sonraki istek artık önbellekten bulmalı.
    const cached = getGameMetaByIds(db, [2]);
    expect(cached.get(2)?.name).toBe('Yeni');
  });

  it('sıfır etiketli SteamSpy sonucu atlanır, önbelleğe yazılmaz', async () => {
    const db = openDb(':memory:');
    const fetchImpl = spyFetch(() => ({ tags: {}, positive: 1, negative: 0, owners: '0' }));

    const result = await loadOwnedGamesMeta(
      db, [game({ appid: 3, playtime_forever: 600 })], fetchImpl as unknown as typeof fetch,
    );

    expect(result.has(3)).toBe(false);
    expect(getGameMetaByIds(db, [3]).size).toBe(0);
  });

  it('bir oyunun SteamSpy hatası diğerlerinin işlenmesini engellemez', async () => {
    const db = openDb(':memory:');
    const fetchImpl = spyFetch((appid) =>
      appid === 4 ? null : { tags: { X: 1 }, positive: 1, negative: 0, owners: '0' });

    const result = await loadOwnedGamesMeta(
      db,
      [game({ appid: 4, playtime_forever: 700 }), game({ appid: 5, playtime_forever: 600 })],
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.has(4)).toBe(false);
    expect(result.get(5)?.tags.get('X')).toBeCloseTo(1);
  });

  it('ardışık SteamSpy istekleri arasında en az 1100ms boşluk bırakır (R4)', async () => {
    vi.useFakeTimers();
    const db = openDb(':memory:');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ tags: { X: 1 }, positive: 1, negative: 0, owners: '0' }),
    }));

    const promise = loadOwnedGamesMeta(
      db,
      [game({ appid: 6, playtime_forever: 700 }), game({ appid: 7, playtime_forever: 600 })],
      fetchImpl as unknown as typeof fetch,
    );

    // İlk istek hiç bekleme olmadan hemen yapılır.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // 1099ms'de ikinci istek henüz yapılmamış olmalı.
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Tam 1100ms'de ikinci istek yapılmalı.
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await promise;
  });

  it('MIN_PLAYTIME_MINUTES altındaki oyunlar için hiç SteamSpy çağrılmaz', async () => {
    const db = openDb(':memory:');
    const fetchImpl = spyFetch(() => ({ tags: { X: 1 }, positive: 1, negative: 0, owners: '0' }));

    await loadOwnedGamesMeta(
      db, [game({ appid: 8, playtime_forever: MIN_PLAYTIME_MINUTES - 1 })],
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
