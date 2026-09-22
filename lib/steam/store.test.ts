import { describe, it, expect, vi } from 'vitest';
import { fetchStoreDetails, parseReleaseDate, fetchNewReleaseAppIds } from './store';

describe('parseReleaseDate', () => {
  it('Steam tarih biçimini ISO’ya çevirir', () => {
    expect(parseReleaseDate('12 Sep, 2026')).toBe('2026-09-12');
  });
  it('çözemediğinde null döner', () => {
    expect(parseReleaseDate('Coming soon')).toBeNull();
  });
  it('undefined girdide null döner', () => {
    expect(parseReleaseDate(undefined)).toBeNull();
  });
});

describe('fetchStoreDetails', () => {
  it('oyun verisini döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '42': { success: true, data: {
        name: 'Test Game', type: 'game',
        genres: [{ description: 'Action' }, { description: 'Indie' }],
        release_date: { coming_soon: false, date: '12 Sep, 2026' },
      } } }),
    });
    const out = await fetchStoreDetails(42, f as never);
    expect(out?.name).toBe('Test Game');
    expect(out?.genres).toEqual(['Action', 'Indie']);
    expect(out?.releaseDate).toBe('2026-09-12');
  });

  it('success:false ise null döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ '42': { success: false } }),
    });
    await expect(fetchStoreDetails(42, f as never)).resolves.toBeNull();
  });

  it('oyun olmayan (dlc) girdide null döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '42': { success: true, data: {
        name: 'Some DLC', type: 'dlc', genres: [],
        release_date: { coming_soon: false, date: '12 Sep, 2026' },
      } } }),
    });
    await expect(fetchStoreDetails(42, f as never)).resolves.toBeNull();
  });

  it('HTTP hatasında fırlatır', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchStoreDetails(42, f as never)).rejects.toThrow();
  });
});

describe('fetchNewReleaseAppIds', () => {
  it('sayfa sonuçlarından appid çıkarır ve tekrarları temizler', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { logo: 'https://cdn.example.com/apps/111/header.jpg' },
          { logo: 'https://cdn.example.com/apps/222/header.jpg' },
          { logo: 'https://cdn.example.com/apps/111/header.jpg' },
        ],
      }),
    });
    const ids = await fetchNewReleaseAppIds(f as never, 1);
    expect(ids).toEqual([111, 222]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('HTTP hatasında sayfalamayı durdurur, fırlatmaz', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const ids = await fetchNewReleaseAppIds(f as never, 3);
    expect(ids).toEqual([]);
  });
});
