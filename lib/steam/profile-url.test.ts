import { describe, it, expect, vi } from 'vitest';
import { parseProfileUrl, resolveToSteamId64 } from './profile-url';
import { InvalidProfileUrlError, VanityNotFoundError } from './types';

describe('parseProfileUrl', () => {
  it('profiles/<id64> biçimini tanır', () => {
    expect(parseProfileUrl('https://steamcommunity.com/profiles/76561198012345678'))
      .toEqual({ kind: 'id64', id: '76561198012345678' });
  });

  it('id/<vanity> biçimini tanır', () => {
    expect(parseProfileUrl('https://steamcommunity.com/id/gaben/'))
      .toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('çıplak SteamID64 kabul eder', () => {
    expect(parseProfileUrl('76561198012345678'))
      .toEqual({ kind: 'id64', id: '76561198012345678' });
  });

  it('steamcommunity dışı alan adını reddeder', () => {
    expect(() => parseProfileUrl('https://evil.example/id/gaben'))
      .toThrow(InvalidProfileUrlError);
  });

  it('benzeyen ama farklı alan adlarını reddeder (subdomain/suffix sahtekarlığı)', () => {
    expect(() => parseProfileUrl('https://steamcommunity.com.evil.example/id/gaben'))
      .toThrow(InvalidProfileUrlError);
    expect(() => parseProfileUrl('https://evilsteamcommunity.com/id/gaben'))
      .toThrow(InvalidProfileUrlError);
  });

  it('anlamsız girdiyi reddeder', () => {
    expect(() => parseProfileUrl('merhaba')).toThrow(InvalidProfileUrlError);
  });
});

describe('resolveToSteamId64', () => {
  it('id64 girdisinde ağ çağrısı yapmaz', async () => {
    const f = vi.fn();
    await expect(resolveToSteamId64('76561198012345678', 'k', f as never))
      .resolves.toBe('76561198012345678');
    expect(f).not.toHaveBeenCalled();
  });

  it('/profiles/<id64> URL girdisinde de ağ çağrısı yapmaz', async () => {
    const f = vi.fn();
    await expect(
      resolveToSteamId64(
        'https://steamcommunity.com/profiles/76561198012345678',
        'k',
        f as never,
      ),
    ).resolves.toBe('76561198012345678');
    expect(f).not.toHaveBeenCalled();
  });

  it('vanity çözümler', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: { success: 1, steamid: '76561198012345678' } }),
    });
    await expect(resolveToSteamId64('https://steamcommunity.com/id/gaben', 'k', f as never))
      .resolves.toBe('76561198012345678');
  });

  it('success:42 bulunamadı hatasına çevrilir', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: { success: 42, message: 'No match' } }),
    });
    await expect(resolveToSteamId64('https://steamcommunity.com/id/yok', 'k', f as never))
      .rejects.toBeInstanceOf(VanityNotFoundError);
  });

  it('anlamsız girdi için ağ çağrısı yapmadan InvalidProfileUrlError fırlatır', async () => {
    const f = vi.fn();
    await expect(resolveToSteamId64('merhaba', 'k', f as never))
      .rejects.toBeInstanceOf(InvalidProfileUrlError);
    expect(f).not.toHaveBeenCalled();
  });
});
