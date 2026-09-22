import { describe, it, expect, vi } from 'vitest';
import { normalizeTags, fetchSteamSpyTags } from './client';

describe('normalizeTags', () => {
  it('en yüksek oya böler — popüler oyun sırf çok oy aldığı için baskın çıkmasın', () => {
    const out = normalizeTags({ 'Souls-like': 1000, 'Metroidvania': 500, 'Indie': 250 });
    expect(out.get('Souls-like')).toBeCloseTo(1.0);
    expect(out.get('Metroidvania')).toBeCloseTo(0.5);
    expect(out.get('Indie')).toBeCloseTo(0.25);
  });

  it('boş etiket kümesinde boş Map döner', () => {
    expect(normalizeTags({}).size).toBe(0);
  });

  it('tüm oylar sıfırsa sıfıra bölmez', () => {
    const out = normalizeTags({ 'A': 0, 'B': 0 });
    expect([...out.values()].every(Number.isFinite)).toBe(true);
  });
});

describe('fetchSteamSpyTags', () => {
  it('etiketleri ve inceleme sayılarını döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: { 'Souls-like': 800, 'Difficult': 400 },
        positive: 900, negative: 100, owners: '500,000 .. 1,000,000',
      }),
    });
    const out = await fetchSteamSpyTags(1, f as never);
    expect(out.tags.get('Souls-like')).toBeCloseTo(1.0);
    expect(out.positive).toBe(900);
    expect(out.owners).toBeGreaterThan(0);
  });

  it('HTTP hatasında null-benzeri boş sonuç yerine fırlatır', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchSteamSpyTags(1, f as never)).rejects.toThrow();
  });

  it('tags alanı boş dizi olduğunda boş Map döner (obje değil, dizi şekli)', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [], positive: 5, negative: 1, owners: '0 .. 20,000' }),
    });
    const out = await fetchSteamSpyTags(1, f as never);
    expect(out.tags.size).toBe(0);
  });
});
