import { describe, it, expect, vi, afterEach } from 'vitest';
import { openDb } from './db';
import { refreshCatalog } from './refresh';

const DELAY = 1000;

/**
 * Store araması 3 appid döndürür ve her biri FARKLI bir çıkış yolunu zorlar:
 *
 *   appid 1 → `success: false`  → `fetchStoreDetails` null döner → erken `continue`
 *   appid 2 → HTTP 500          → `fetchStoreDetails` fırlatır  → `catch`
 *   appid 3 → geçerli oyun      → başarı yolu
 *
 * R18'in korunması gereken davranışı: bu ÜÇ yolun da bir sonraki oyuna
 * geçmeden önce duraklaması. `sleep` `try` bloğunun içinde olsaydı, art arda
 * gelen oyun-olmayan appid'ler (DLC, soundtrack, henüz çıkmamış) Store'a
 * duraksız bir istek dizisi gönderirdi — oran sınırını tetikleyen tam olarak
 * budur. `continue` bir `finally` bloğunu ATLAMAZ; test bunu ölçer.
 */
function stubFetch() {
  const impl = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/search/results/')) {
      return {
        ok: true,
        json: async () => ({
          items: [
            { logo: 'https://cdn.example/apps/1/logo.jpg' },
            { logo: 'https://cdn.example/apps/2/logo.jpg' },
            { logo: 'https://cdn.example/apps/3/logo.jpg' },
          ],
        }),
      };
    }
    if (u.includes('appids=1')) {
      return { ok: true, json: async () => ({ '1': { success: false } }) };
    }
    if (u.includes('appids=2')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (u.includes('appids=3')) {
      return {
        ok: true,
        json: async () => ({
          '3': {
            success: true,
            data: {
              name: 'Yeni Oyun', type: 'game',
              genres: [{ description: 'Action' }],
              release_date: { coming_soon: false, date: '1 Sep, 2026' },
            },
          },
        }),
      };
    }
    // SteamSpy
    return {
      ok: true,
      json: async () => ({
        tags: { 'Souls-like': 100 }, positive: 90, negative: 10,
        owners: '20,000 .. 50,000',
      }),
    };
  });
  vi.stubGlobal('fetch', impl);
  return impl;
}

const storeCalls = (f: ReturnType<typeof stubFetch>) =>
  f.mock.calls.filter((c) => String(c[0]).includes('/api/appdetails')).length;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('refreshCatalog — her çıkış yolu duraklatır (R18)', () => {
  it('ERKEN CONTINUE yolundan sonra da bekler (oyun olmayan appid)', async () => {
    vi.useFakeTimers();
    const f = stubFetch();
    const promise = refreshCatalog(openDb(':memory:'), { pages: 1, delayMs: DELAY });

    // appid 1'in Store isteği beklemeden yapılır.
    await vi.advanceTimersByTimeAsync(0);
    expect(storeCalls(f)).toBe(1);

    // appid 1 "oyun değil" dedi ve `continue` ile döngü başına döndü.
    // `sleep` `finally`'de olduğu için BU YOL DA duraklamalı.
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(storeCalls(f)).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(storeCalls(f)).toBe(2);

    await vi.runAllTimersAsync();
    await promise;
  });

  it('HATA yolundan sonra da bekler (Store HTTP 500)', async () => {
    vi.useFakeTimers();
    const f = stubFetch();
    const promise = refreshCatalog(openDb(':memory:'), { pages: 1, delayMs: DELAY });

    // appid 2'nin isteğine kadar ilerle.
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(storeCalls(f)).toBe(2);

    // appid 2 fırlattı; `catch`ten sonra `finally` duraklatmalı.
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(storeCalls(f)).toBe(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(storeCalls(f)).toBe(3);

    await vi.runAllTimersAsync();
    await promise;
  });

  it('üç yolu da doğru sayar ve başarılı oyunu kataloğa yazar', async () => {
    stubFetch();
    const db = openDb(':memory:');
    const r = await refreshCatalog(db, { pages: 1, delayMs: 0 });
    expect(r).toEqual({ added: 1, skipped: 2, totalFound: 3 });
    const row = db.prepare('SELECT appid, name FROM game_meta').all() as Array<{
      appid: number; name: string;
    }>;
    expect(row).toEqual([{ appid: 3, name: 'Yeni Oyun' }]);
  });

  it('hiç appid bulunamazsa operatörü uyarır (sessiz "sakin hafta" değil)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = await refreshCatalog(openDb(':memory:'), { pages: 1, delayMs: 0 });
      expect(r.totalFound).toBe(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
