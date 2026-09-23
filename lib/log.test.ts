import { describe, it, expect, vi, afterEach } from 'vitest';
import { logError } from './log';

function yakala(fn: () => void): string {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    fn();
    return spy.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('logError', () => {
  it('yapılandırılmış JSON yazar: kapsam, hata türü ve mesaj', () => {
    const out = yakala(() => logError('test.kapsam', new TypeError('bir şey patladı')));
    const j = JSON.parse(out) as Record<string, unknown>;
    expect(j.scope).toBe('test.kapsam');
    expect(j.error).toBe('TypeError');
    expect(j.message).toBe('bir şey patladı');
    expect(j.level).toBe('error');
  });

  it('ek alanları (ör. appid) taşır', () => {
    const out = yakala(() => logError('test', new Error('x'), { appid: 42 }));
    expect(JSON.parse(out).appid).toBe(42);
  });

  it('Error olmayan değerleri de yutmadan yazar', () => {
    const out = yakala(() => logError('test', 'düz dizge'));
    expect(JSON.parse(out).message).toBe('düz dizge');
  });

  // --- Gizlilik sözleşmesi --------------------------------------------------
  it('API anahtarını mesajdan siler', () => {
    const out = yakala(() =>
      logError('test', new Error('fetch https://api.steampowered.com/x?key=SUPERGIZLI&a=1')));
    expect(out).not.toContain('SUPERGIZLI');
    expect(out).toContain('[GİZLENDİ]');
  });

  it('SteamID64’ü mesajdan siler', () => {
    const out = yakala(() => logError('test', new Error('steamid 76561198012345678 hata')));
    expect(out).not.toContain('76561198012345678');
    expect(out).toContain('[STEAMID]');
  });

  it('steamids sorgu parametresini siler', () => {
    const out = yakala(() =>
      logError('test', new Error('GET /GetPlayerSummaries?steamids=76561198012345678')));
    expect(out).not.toContain('76561198012345678');
  });
});
