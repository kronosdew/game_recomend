import { describe, it, expect } from 'vitest';
import { mmrRerank } from './mmr';
import { l2Normalize } from './vector';
import type { Scored } from './scoring';
import type { GameMeta } from '@/lib/steam/types';

function cand(appid: number, tag: string, score: number): Scored {
  const meta: GameMeta = {
    appid, name: `G${appid}`, tags: new Map([[tag, 1]]), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
  return { meta, vector: l2Normalize(new Map([[tag, 1]])), score };
}

describe('mmrRerank', () => {
  it('tek tip listeyi çeşitlendirir', () => {
    const input = [
      cand(1, 'Souls-like', 0.90),
      cand(2, 'Souls-like', 0.89),
      cand(3, 'Puzzle', 0.50),
    ];
    const out = mmrRerank(input, 0.5, 3);
    expect(out[0].meta.appid).toBe(1);
    // İkinci sırada aynı etiketin kopyası değil, farklı tür gelmeli
    expect(out[1].meta.appid).toBe(3);
  });

  it('lambda=1 ise saf skor sırasını korur', () => {
    const input = [cand(1, 'A', 0.9), cand(2, 'A', 0.8), cand(3, 'B', 0.7)];
    expect(mmrRerank(input, 1, 3).map(s => s.meta.appid)).toEqual([1, 2, 3]);
  });

  it('en fazla k eleman döner', () => {
    const input = [cand(1, 'A', 0.9), cand(2, 'B', 0.8), cand(3, 'C', 0.7)];
    expect(mmrRerank(input, 0.7, 2)).toHaveLength(2);
  });

  it('boş girdide boş döner', () => {
    expect(mmrRerank([], 0.7, 10)).toEqual([]);
  });

  it('k girdi sayısından büyükse hepsini döner', () => {
    const input = [cand(1, 'A', 0.9)];
    expect(mmrRerank(input, 0.7, 10)).toHaveLength(1);
  });

  // --- Ek testler (rigor gereği): boyanan davranışların gerçekten test edildiğini kanıtlar ---

  it('k=0 ise boş döner (döngü sınırı dahil değil)', () => {
    const input = [cand(1, 'A', 0.9), cand(2, 'B', 0.8)];
    expect(mmrRerank(input, 0.7, 0)).toEqual([]);
  });

  it('girdi dizisini mutasyona uğratmaz', () => {
    const input = [
      cand(1, 'Souls-like', 0.90),
      cand(2, 'Souls-like', 0.89),
      cand(3, 'Puzzle', 0.50),
    ];
    const snapshot = [...input];
    mmrRerank(input, 0.5, 2);
    expect(input).toEqual(snapshot);
    expect(input).toHaveLength(3);
    expect(input[0].meta.appid).toBe(1);
    expect(input[1].meta.appid).toBe(2);
    expect(input[2].meta.appid).toBe(3);
  });

  it('MMR değeri eşitse önce gelen aday seçilir (kararlı sıralama)', () => {
    // Aynı skor + aynı vektör => her adımda MMR değeri tam eşit.
    // Katı ">" karşılaştırması ilk adayı korumalı; ">=" olsaydı sondaki
    // aday seçilir ve sıra ters dönerdi.
    const input = [cand(1, 'A', 0.5), cand(2, 'A', 0.5)];
    const out = mmrRerank(input, 0.5, 2);
    expect(out.map(s => s.meta.appid)).toEqual([1, 2]);
  });
});
