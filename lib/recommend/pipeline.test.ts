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

// --- R24 / C1: MMR ölçek uyumu (kompozisyon testi) -------------------------
// İki elemanlı bir havuz bu hatayı GÖREMEZ: hangi sırayla gelirlerse gelsinler
// ikisi de seçilir. Bu yüzden burada iki farklı tür kümesi ve altı aday var.
describe('recommend — MMR ölçek uyumu (R24)', () => {
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
    { appid: 2, name: 'Dead Cells', playtime_forever: 4800 },
  ];
  const metaById = new Map<number, GameMeta>([
    [1, meta(1, { Metroidvania: 1, Zor: 0.8, Bağımsız: 0.4 })],
    [2, meta(2, { Metroidvania: 0.9, Zor: 1, Bağımsız: 0.4 })],
  ]);

  function cand(appid: number, name: string, tags: Record<string, number>) {
    return {
      meta: meta(appid, tags, { name, owners: 20_000 }),
      vector: l2Normalize(new Map(Object.entries(tags))),
    };
  }

  // Kullanıcının zevkiyle örtüşen küme.
  const YAKIN = [
    cand(50, 'Yakın A', { Metroidvania: 1, Zor: 0.7, Bağımsız: 0.3 }),
    cand(51, 'Yakın B', { Zor: 1, Metroidvania: 0.6, Bağımsız: 0.3 }),
    cand(52, 'Yakın C', { Metroidvania: 1, Zor: 1 }),
  ];
  // Örtüşmeyen küme: skorları SIFIR DEĞİL (ortak "Bağımsız" etiketi var), bu
  // yüzden R25 elemesine takılmazlar — sıralamayı bozup bozmadıkları yalnızca
  // MMR'ın ölçek uyumuna bağlıdır.
  const UZAK = [
    cand(60, 'Uzak A', { Çiftlik: 1, Bağımsız: 0.3 }),
    cand(61, 'Uzak B', { Bulmaca: 1, Bağımsız: 0.3 }),
    cand(62, 'Uzak C', { Spor: 1, Bağımsız: 0.3 }),
  ];
  const pool = [...YAKIN, ...UZAK];
  const YAKIN_IDS = new Set(YAKIN.map((c) => c.meta.appid));

  it('ilk üç sıra kullanıcının zevkiyle hizalı kümeden gelir', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out).toHaveLength(6);
    const ilkUc = out.slice(0, 3).map((r) => r.meta.appid);
    expect([...ilkUc].sort()).toEqual([50, 51, 52]);
  });

  it('2. ve 3. sıraya alakasız aday sızmaz (çeşitlilik cezası alakayı ezmemeli)', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(YAKIN_IDS.has(out[1].meta.appid)).toBe(true);
    expect(YAKIN_IDS.has(out[2].meta.appid)).toBe(true);
  });

  it('yanıttaki skor §6.3 skorudur — normalize edilmiş skor dışarı sızmaz', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    const enYuksek = Math.max(...out.map((r) => r.score));
    // Normalize skor sızsaydı en yüksek skor tam olarak 1 olurdu.
    expect(enYuksek).not.toBe(1);
    // §6.3 popülerlik sönümlemesi skoru ~0.12 tavanına sıkıştırır.
    expect(enYuksek).toBeGreaterThan(0);
    expect(enYuksek).toBeLessThan(0.2);
  });

  it('çeşitlilik tümüyle kapanmaz: alakasız küme listeye girer ama sonda kalır', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    const sonUc = out.slice(3).map((r) => r.meta.appid);
    expect([...sonUc].sort()).toEqual([60, 61, 62]);
  });
});

// --- R25 / C2: alaka tabanı ------------------------------------------------
describe('recommend — alaka tabanı (R25)', () => {
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
  ];
  const metaById = new Map<number, GameMeta>([[1, meta(1, { Metroidvania: 1 })]]);

  it('skoru tam SIFIR olan aday elenir (kullanıcı zevkiyle hiç kesişmiyor)', () => {
    const pool = [
      { meta: meta(50, { Metroidvania: 1 }, { name: 'Uyan' }),
        vector: l2Normalize(new Map([['Metroidvania', 1]])) },
      { meta: meta(51, { Tarım: 1 }, { name: 'Kesişmeyen' }),
        vector: l2Normalize(new Map([['Tarım', 1]])) },
    ];
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out.map((r) => r.meta.appid)).toEqual([50]);
  });

  it('tüm adaylar <= 0 ise boş dizi döner (20 sahte öneri üretmez)', () => {
    const pool = [
      { meta: meta(60, { Tarım: 1 }), vector: l2Normalize(new Map([['Tarım', 1]])) },
      { meta: meta(61, { Spor: 1 }), vector: l2Normalize(new Map([['Spor', 1]])) },
      { meta: meta(62, { Bulmaca: 1 }), vector: l2Normalize(new Map([['Bulmaca', 1]])) },
    ];
    expect(recommend({ games, metaById, pool, now: NOW })).toEqual([]);
  });

  it('NEGATİF skorlu aday asla listeye girmez', () => {
    // Bir yıldan uzun süredir dokunulmamış, 30 dk'dan az oynanmış oyun
    // etiketlerine negatif ağırlık verir (spec §6.6).
    const terkEdilmis: OwnedGame = {
      appid: 3, name: 'Terk Edilmiş Futbol', playtime_forever: 10,
      rtime_last_played: Math.floor(NOW.getTime() / 1000) - 2 * 365 * 24 * 3600,
    };
    const metaIle = new Map(metaById);
    metaIle.set(3, meta(3, { Futbol: 1 }));

    const pool = [
      { meta: meta(50, { Metroidvania: 1 }, { name: 'Uyan' }),
        vector: l2Normalize(new Map([['Metroidvania', 1]])) },
      { meta: meta(70, { Futbol: 1 }, { name: 'Yeni Futbol' }),
        vector: l2Normalize(new Map([['Futbol', 1]])) },
    ];
    const out = recommend({
      games: [...games, terkEdilmis], metaById: metaIle, pool, now: NOW,
    });
    expect(out.map((r) => r.meta.appid)).toEqual([50]);
    expect(out.every((r) => r.score > 0)).toBe(true);
  });
});
