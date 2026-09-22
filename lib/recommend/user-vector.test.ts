import { describe, it, expect } from 'vitest';
import { buildUserVector } from './user-vector';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

function meta(appid: number, tags: Record<string, number>): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)),
    genres: [], releaseDate: '2020-01-01',
    reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
}

const NOW = 1_800_000_000;

describe('buildUserVector', () => {
  it('60 dakikanın altındaki oyunları yok sayar', () => {
    const games: OwnedGame[] = [{ appid: 1, name: 'G1', playtime_forever: 30 }];
    const v = buildUserVector(games, new Map([[1, meta(1, { A: 1 })]]), NOW);
    expect(v.size).toBe(0);
  });

  it('log ölçek kullanır — 2000 saat, 100 saati ezmez', () => {
    const games: OwnedGame[] = [
      { appid: 1, name: 'A', playtime_forever: 2000 * 60 },
      { appid: 2, name: 'B', playtime_forever: 100 * 60 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const v = buildUserVector(games, metas, NOW);
    // log1p(2000)/log1p(100) ≈ 1.65 — lineer olsaydı 20 olurdu
    expect(v.get('A')! / v.get('B')!).toBeLessThan(2);
  });

  it('son iki haftada oynananı öne çıkarır', () => {
    const base: OwnedGame[] = [
      { appid: 1, name: 'A', playtime_forever: 600 },
      { appid: 2, name: 'B', playtime_forever: 600 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const withRecent = buildUserVector(
      [{ ...base[0], playtime_2weeks: 120 }, base[1]], metas, NOW,
    );
    expect(withRecent.get('A')!).toBeGreaterThan(withRecent.get('B')!);
  });

  it('metadata bulunmayan oyunu atlar', () => {
    const games: OwnedGame[] = [{ appid: 99, name: 'X', playtime_forever: 600 }];
    expect(buildUserVector(games, new Map(), NOW).size).toBe(0);
  });

  it('1 yıldan eski, 30 dk altı oyunlara negatif ağırlık verir', () => {
    const games: OwnedGame[] = [
      { appid: 1, name: 'Sevilen', playtime_forever: 600 },
      { appid: 2, name: 'Terk', playtime_forever: 10,
        rtime_last_played: NOW - 400 * 24 * 3600 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const v = buildUserVector(games, metas, NOW);
    expect(v.get('B')!).toBeLessThan(0);
  });

  it('hiç uygun oyun yoksa boş vektör döner, NaN üretmez', () => {
    const v = buildUserVector([], new Map(), NOW);
    expect(v.size).toBe(0);
    expect([...v.values()].every(Number.isFinite)).toBe(true);
  });

  it('sonuç L2 normalize edilmiştir', () => {
    const games: OwnedGame[] = [{ appid: 1, name: 'A', playtime_forever: 600 }];
    const v = buildUserVector(games, new Map([[1, meta(1, { A: 3, B: 4 })]]), NOW);
    const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });
});
