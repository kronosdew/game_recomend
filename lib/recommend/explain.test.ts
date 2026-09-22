import { describe, it, expect } from 'vitest';
import { explainRecommendation } from './explain';
import { l2Normalize } from './vector';
import { MIN_PLAYTIME_MINUTES } from './constants';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

function meta(appid: number, tags: Record<string, number>): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
}

describe('explainRecommendation', () => {
  const user = l2Normalize(new Map([['Metroidvania', 0.8], ['Souls-like', 0.6]]));
  const candidate = {
    meta: { ...meta(9, { Metroidvania: 1, 'Souls-like': 0.5 }), name: 'Yeni Oyun' },
    vector: l2Normalize(new Map([['Metroidvania', 1], ['Souls-like', 0.5]])),
  };
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
    { appid: 2, name: 'Dead Cells', playtime_forever: 4800 },
    { appid: 3, name: 'Alakasız Oyun', playtime_forever: 6000 },
  ];
  const metas = new Map([
    [1, meta(1, { Metroidvania: 1 })],
    [2, meta(2, { Metroidvania: 0.8, 'Souls-like': 1 })],
    [3, meta(3, { Tarım: 1 })],
  ]);

  it('en çok katkı veren etiketleri döner', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.topTags[0]).toBe('Metroidvania');
    expect(e.topTags.length).toBeLessThanOrEqual(3);
  });

  it('o etiketleri taşıyan oyunları gerekçe olarak gösterir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    const names = e.drivingGames.map(g => g.name);
    expect(names).toContain('Hollow Knight');
    expect(names).not.toContain('Alakasız Oyun');
  });

  it('saat cinsinden süre verir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.drivingGames[0].hours).toBe(120);
  });

  it('okunabilir Türkçe metin üretir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.text).toContain('Hollow Knight');
    expect(e.text).toContain('Metroidvania');
  });

  it('ortak etiket yoksa boş gerekçeyle çökmeden döner', () => {
    const e = explainRecommendation(
      l2Normalize(new Map([['Tarım', 1]])),
      { meta: meta(9, { Yarış: 1 }), vector: l2Normalize(new Map([['Yarış', 1]])) },
      games, metas,
    );
    expect(e.topTags).toEqual([]);
    expect(typeof e.text).toBe('string');
  });

  // --- Boundary / rigor tests (R15) beyond the brief's list ---

  it('negatif kullanıcı ağırlıklı etiketi topTags dışında bırakır (uw > 0 filtresi)', () => {
    // Kullanıcı 'Tarım' etiketinden hoşlanmıyor (negatif ağırlık) ama aday bu etiketi taşıyor.
    // Aday ayrıca pozitif ağırlıklı 'Metroidvania' de taşıyor.
    const userWithDislike: Map<string, number> = new Map([
      ['Metroidvania', 0.8],
      ['Tarım', -0.5],
    ]);
    const c = {
      meta: meta(9, { Metroidvania: 1, Tarım: 1 }),
      vector: new Map([
        ['Metroidvania', 0.7],
        ['Tarım', 0.7],
      ]),
    };
    const e = explainRecommendation(userWithDislike, c, games, metas);
    expect(e.topTags).not.toContain('Tarım');
    expect(e.topTags).toContain('Metroidvania');
  });

  it('kullanıcı yalnızca negatif ağırlıklı ortak etikete sahipse topTags boş döner', () => {
    const userAllNegative: Map<string, number> = new Map([['Tarım', -0.9]]);
    const c = { meta: meta(9, { Tarım: 1 }), vector: new Map([['Tarım', 1]]) };
    const e = explainRecommendation(userAllNegative, c, games, metas);
    expect(e.topTags).toEqual([]);
  });

  it('topTags en fazla 3 etiket döner (üst sınır)', () => {
    const manyTagsUser: Map<string, number> = new Map([
      ['A', 0.9], ['B', 0.8], ['C', 0.7], ['D', 0.6],
    ]);
    const c = {
      meta: meta(9, { A: 1, B: 1, C: 1, D: 1 }),
      vector: new Map([['A', 0.9], ['B', 0.8], ['C', 0.7], ['D', 0.6]]),
    };
    const e = explainRecommendation(manyTagsUser, c, games, metas);
    expect(e.topTags.length).toBe(3);
    // en yüksek katkılı 3 etiket (A, B, C) döner, D dışarıda kalır
    expect(e.topTags).toEqual(['A', 'B', 'C']);
  });

  it('drivingGames en fazla 2 oyun döner (üst sınır)', () => {
    const manyGames: OwnedGame[] = [
      { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
      { appid: 2, name: 'Dead Cells', playtime_forever: 4800 },
      { appid: 4, name: 'Ori', playtime_forever: 3000 },
    ];
    const manyMetas = new Map([
      [1, meta(1, { Metroidvania: 1 })],
      [2, meta(2, { Metroidvania: 0.8, 'Souls-like': 1 })],
      [4, meta(4, { Metroidvania: 1 })],
    ]);
    const e = explainRecommendation(user, candidate, manyGames, manyMetas);
    expect(e.drivingGames.length).toBeLessThanOrEqual(2);
    expect(e.drivingGames.length).toBe(2);
  });

  it('MIN_PLAYTIME_MINUTES sınırının altındaki oyunu gerekçe olarak göstermez', () => {
    const shortPlayGames: OwnedGame[] = [
      { appid: 1, name: 'Hollow Knight', playtime_forever: MIN_PLAYTIME_MINUTES - 1 },
    ];
    const shortMetas = new Map([[1, meta(1, { Metroidvania: 1 })]]);
    const e = explainRecommendation(user, candidate, shortPlayGames, shortMetas);
    expect(e.drivingGames).toEqual([]);
  });

  it('MIN_PLAYTIME_MINUTES eşiğinde olan oyunu gerekçe olarak dahil eder (>=)', () => {
    const exactPlayGames: OwnedGame[] = [
      { appid: 1, name: 'Hollow Knight', playtime_forever: MIN_PLAYTIME_MINUTES },
    ];
    const exactMetas = new Map([[1, meta(1, { Metroidvania: 1 })]]);
    const e = explainRecommendation(user, candidate, exactPlayGames, exactMetas);
    expect(e.drivingGames.map(g => g.name)).toContain('Hollow Knight');
  });

  it('ortak etiket yoksa genel Türkçe geri dönüş cümlesi verir', () => {
    const e = explainRecommendation(
      l2Normalize(new Map([['Tarım', 1]])),
      { meta: meta(9, { Yarış: 1 }), vector: l2Normalize(new Map([['Yarış', 1]])) },
      games, metas,
    );
    expect(e.text.length).toBeGreaterThan(0);
    expect(e.drivingGames).toEqual([]);
  });
});
