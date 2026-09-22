import { describe, it, expect } from 'vitest';
import { l2Normalize, cosine } from './vector';

describe('l2Normalize', () => {
  it('birim uzunluğa indirger', () => {
    const v = l2Normalize(new Map([['a', 3], ['b', 4]]));
    expect(v.get('a')).toBeCloseTo(0.6);
    expect(v.get('b')).toBeCloseTo(0.8);
  });

  it('boş vektörde sıfıra bölmez', () => {
    expect(l2Normalize(new Map()).size).toBe(0);
  });

  it('tüm değerler sıfırsa NaN üretmez', () => {
    const v = l2Normalize(new Map([['a', 0]]));
    expect([...v.values()].every(Number.isFinite)).toBe(true);
  });
});

describe('cosine', () => {
  it('aynı yönde 1 verir', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    expect(cosine(a, a)).toBeCloseTo(1);
  });
  it('ortak etiket yoksa 0 verir', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    const b = l2Normalize(new Map([['y', 1]]));
    expect(cosine(a, b)).toBeCloseTo(0);
  });
  it('boş vektörle 0 verir, NaN değil', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    expect(cosine(a, new Map())).toBe(0);
  });
});
