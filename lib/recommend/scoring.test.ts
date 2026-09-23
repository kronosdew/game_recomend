import { describe, it, expect } from 'vitest';
import { passesQualityGate, scoreCandidates, daysSince } from './scoring';
import { l2Normalize } from './vector';
import type { GameMeta } from '@/lib/steam/types';
import {
  MIN_REVIEWS, MIN_POSITIVE_RATIO, RELEASE_WINDOW_DAYS,
} from './constants';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid: 1, name: 'G', tags: new Map([['A', 1]]), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('daysSince', () => {
  it('gün farkını hesaplar', () => {
    expect(daysSince('2026-09-12', NOW)).toBe(10);
  });
});

describe('passesQualityGate', () => {
  it('spec eşiklerini karşılayanı geçirir', () => {
    expect(passesQualityGate(meta(), NOW)).toBe(true);
  });
  it('az incelemeliyi eler', () => {
    expect(passesQualityGate(meta({ reviewCount: 49 }), NOW)).toBe(false);
  });
  it('düşük beğeniliyi eler', () => {
    expect(passesQualityGate(meta({ positiveRatio: 0.69 }), NOW)).toBe(false);
  });
  it('90 günden eskiyi eler', () => {
    expect(passesQualityGate(meta({ releaseDate: '2026-01-01' }), NOW)).toBe(false);
  });
  it('gelecek tarihliyi eler', () => {
    expect(passesQualityGate(meta({ releaseDate: '2027-01-01' }), NOW)).toBe(false);
  });

  // --- Sınır testleri: eşiğin TAM ÜSTÜ dahildir --------------------------
  // "49 eleniyor" testi, eşik 51'e kayarsa da geçer; kapının nerede
  // durduğunu yalnızca eşiğin kendisi pinler.
  it(`tam ${MIN_REVIEWS} inceleme GEÇER (eşik dahil)`, () => {
    expect(passesQualityGate(meta({ reviewCount: MIN_REVIEWS }), NOW)).toBe(true);
  });

  it(`tam %${MIN_POSITIVE_RATIO * 100} pozitif oran GEÇER (eşik dahil)`, () => {
    expect(passesQualityGate(meta({ positiveRatio: MIN_POSITIVE_RATIO }), NOW)).toBe(true);
  });

  it(`tam ${RELEASE_WINDOW_DAYS} günlük oyun GEÇER (pencere dahil)`, () => {
    // 2026-09-22 eksi 90 gün = 2026-06-24
    expect(daysSince('2026-06-24', NOW)).toBe(RELEASE_WINDOW_DAYS);
    expect(passesQualityGate(meta({ releaseDate: '2026-06-24' }), NOW)).toBe(true);
  });

  it(`${RELEASE_WINDOW_DAYS + 1} günlük oyun ELENİR (pencerenin hemen dışı)`, () => {
    expect(daysSince('2026-06-23', NOW)).toBe(RELEASE_WINDOW_DAYS + 1);
    expect(passesQualityGate(meta({ releaseDate: '2026-06-23' }), NOW)).toBe(false);
  });

  it('bugün çıkan oyun GEÇER (0 gün, alt sınır dahil)', () => {
    expect(passesQualityGate(meta({ releaseDate: '2026-09-22' }), NOW)).toBe(true);
  });
});

describe('scoreCandidates', () => {
  const user = l2Normalize(new Map([['Souls-like', 1]]));

  it('sahip olunan oyunu listeden çıkarır', () => {
    const c = [{ meta: meta({ appid: 7 }), vector: l2Normalize(new Map([['Souls-like', 1]])) }];
    expect(scoreCandidates(user, c, new Set([7]), NOW)).toHaveLength(0);
  });

  it('zevke yakın olanı üste koyar', () => {
    const c = [
      { meta: meta({ appid: 1 }), vector: l2Normalize(new Map([['Puzzle', 1]])) },
      { meta: meta({ appid: 2 }), vector: l2Normalize(new Map([['Souls-like', 1]])) },
    ];
    expect(scoreCandidates(user, c, new Set(), NOW)[0].meta.appid).toBe(2);
  });

  it('popülerlik sönümlemesi uygular — eşit benzerlikte az sahipli üste çıkar', () => {
    const v = l2Normalize(new Map([['Souls-like', 1]]));
    const c = [
      { meta: meta({ appid: 1, owners: 5_000_000 }), vector: v },
      { meta: meta({ appid: 2, owners: 20_000 }), vector: v },
    ];
    expect(scoreCandidates(user, c, new Set(), NOW)[0].meta.appid).toBe(2);
  });

  it('etiketsiz adayı eler, NaN skor üretmez', () => {
    const c = [{ meta: meta({ appid: 3, tags: new Map() }), vector: new Map() }];
    const out = scoreCandidates(user, c, new Set(), NOW);
    expect(out).toHaveLength(0);
  });

  it('tüm skorlar sonlu sayıdır', () => {
    const c = [{ meta: meta({ appid: 1 }), vector: l2Normalize(new Map([['A', 1]])) }];
    expect(scoreCandidates(user, c, new Set(), NOW).every(s => Number.isFinite(s.score)))
      .toBe(true);
  });

  it('bozuk yayın tarihinden doğan NaN skoru eler', () => {
    const c = [
      { meta: meta({ appid: 4, releaseDate: 'gecersiz-tarih' }), vector: l2Normalize(new Map([['Souls-like', 1]])) },
      { meta: meta({ appid: 5 }), vector: l2Normalize(new Map([['Souls-like', 1]])) },
    ];
    const out = scoreCandidates(user, c, new Set(), NOW);
    expect(out.map(s => s.meta.appid)).toEqual([5]);
  });
});
