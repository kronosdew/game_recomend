import { describe, it, expect, vi } from 'vitest';
import { fetchWithTimeout } from './fetch';
import { UpstreamTimeoutError } from '@/lib/steam/types';

describe('fetchWithTimeout', () => {
  it('her isteğe bir AbortSignal iliştirir (süresiz bekleme yok)', async () => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<{ ok: boolean }>>(
      async () => ({ ok: true }),
    );
    await fetchWithTimeout(f as never, 'https://ornek.test/', 1000);
    const init = f.mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('TimeoutError’ı UpstreamTimeoutError’a çevirir (yutup 500 vermez)', async () => {
    const f = vi.fn(async () => {
      const e = new Error('timed out');
      e.name = 'TimeoutError';
      throw e;
    });
    await expect(fetchWithTimeout(f as never, 'https://ornek.test/', 5))
      .rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it('AbortError’ı da zaman aşımı sayar', async () => {
    const f = vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    await expect(fetchWithTimeout(f as never, 'https://ornek.test/', 5))
      .rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it('zaman aşımı olmayan hatayı OLDUĞU GİBİ geçirir', async () => {
    const asil = new TypeError('fetch failed');
    const f = vi.fn(async () => { throw asil; });
    await expect(fetchWithTimeout(f as never, 'https://ornek.test/', 5)).rejects.toBe(asil);
  });

  it('hata mesajı adresi (dolayısıyla API anahtarını) taşımaz', async () => {
    const f = vi.fn(async () => {
      const e = new Error('timed out');
      e.name = 'TimeoutError';
      throw e;
    });
    try {
      await fetchWithTimeout(f as never, 'https://api.steampowered.com/x?key=GIZLI', 5);
      throw new Error('fırlatmalıydı');
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('GIZLI');
    }
  });

  it('gerçek bir zaman aşımını uçtan uca yakalar', async () => {
    const yavas = (async (_url: string, init?: RequestInit) => {
      await new Promise((_r, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
      return { ok: true } as never;
    }) as unknown as typeof fetch;
    await expect(fetchWithTimeout(yavas, 'https://ornek.test/', 10))
      .rejects.toBeInstanceOf(UpstreamTimeoutError);
  });
});
