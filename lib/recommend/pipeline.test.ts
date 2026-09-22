import { describe, it, expect } from 'vitest';
import { recommend } from './pipeline';
import { l2Normalize } from './vector';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(appid: number, tags: Record<string, number>, over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('recommend', () => {
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
  ];
  const metaById = new Map([[1, meta(1, { Metroidvania: 1 })]]);
  const pool = [
    { meta: meta(50, { Metroidvania: 1 }, { name: 'Yeni Metroid' }),
      vector: l2Normalize(new Map([['Metroidvania', 1]])) },
    { meta: meta(51, { Tarım: 1 }, { name: 'Çiftlik' }),
      vector: l2Normalize(new Map([['Tarım', 1]])) },
  ];

  it('uygun oyunu üste koyar ve gerekçe taşır', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out[0].meta.name).toBe('Yeni Metroid');
    expect(out[0].explanation.text).toContain('Hollow Knight');
  });

  it('kullanıcının sahip olduğu oyunu önermez', () => {
    const poolWithOwned = [
      { meta: meta(1, { Metroidvania: 1 }), vector: l2Normalize(new Map([['Metroidvania', 1]])) },
      ...pool,
    ];
    const out = recommend({ games, metaById, pool: poolWithOwned, now: NOW });
    expect(out.map(r => r.meta.appid)).not.toContain(1);
  });

  it('boş kütüphanede çökmeden boş liste döner', () => {
    const out = recommend({ games: [], metaById: new Map(), pool, now: NOW });
    expect(out).toEqual([]);
  });

  it('tüm skorlar sonludur', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out.every(r => Number.isFinite(r.score))).toBe(true);
  });

  it('her önerinin bir gerekçe (explanation) alanı vardır', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      expect(r.explanation).toBeDefined();
      expect(typeof r.explanation.text).toBe('string');
      expect(r.explanation.text.length).toBeGreaterThan(0);
    }
  });

  it('havuzda uygun aday yoksa boş liste döner (çökmez)', () => {
    const out = recommend({ games, metaById, pool: [], now: NOW });
    expect(out).toEqual([]);
  });

});
