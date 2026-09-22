import { describe, it, expect, vi } from 'vitest';
import { getOwnedGames, getPlayerSummary } from './client';
import { PrivateProfileError, ProfileNotFoundError } from './types';

const jsonFetch = (payload: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => payload });

describe('getOwnedGames', () => {
  it('oyun listesini döner', async () => {
    const f = jsonFetch({
      response: { game_count: 1, games: [
        { appid: 4000, name: 'Garry’s Mod', playtime_forever: 300 },
      ] },
    });
    const games = await getOwnedGames('765', 'k', f as never);
    expect(games).toHaveLength(1);
    expect(games[0].appid).toBe(4000);
  });

  it('gizli profilde PrivateProfileError atar', async () => {
    const f = jsonFetch({ response: {} });
    await expect(getOwnedGames('765', 'k', f as never))
      .rejects.toBeInstanceOf(PrivateProfileError);
  });

  it('kütüphane boş ama profil açıksa hata DEĞİL, boş dizi döner', async () => {
    const f = jsonFetch({ response: { game_count: 0, games: [] } });
    await expect(getOwnedGames('765', 'k', f as never)).resolves.toEqual([]);
  });

  it('game_count var ama games yoksa boş dizi döner', async () => {
    const f = jsonFetch({ response: { game_count: 0 } });
    await expect(getOwnedGames('765', 'k', f as never)).resolves.toEqual([]);
  });

  it('API anahtarını sorgu dizesine koyar ve ücretsiz oyunları dahil eder', async () => {
    const f = jsonFetch({ response: { game_count: 0, games: [] } });
    await getOwnedGames('765', 'secret', f as never);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('key=secret');
    expect(url).toContain('include_appinfo=1');
    expect(url).toContain('include_played_free_games=1');
  });

  it('HTTP hatası durumunda anlaşılır bir hata fırlatır ve API anahtarını sızdırmaz', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(getOwnedGames('765', 'secret', f as never)).rejects.toThrow();
    try {
      await getOwnedGames('765', 'secret', f as never);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('secret');
    }
  });
});

describe('getPlayerSummary', () => {
  it('oyuncu özetini döner', async () => {
    const f = jsonFetch({
      response: {
        players: [
          {
            personaname: 'Canberk',
            avatarfull: 'https://example.com/avatar.jpg',
            communityvisibilitystate: 3,
          },
        ],
      },
    });
    const summary = await getPlayerSummary('765', 'k', f as never);
    expect(summary).toEqual({
      personaName: 'Canberk',
      avatar: 'https://example.com/avatar.jpg',
      visibility: 3,
    });
  });

  it('oyuncu bulunamazsa ProfileNotFoundError atar (PrivateProfileError DEĞİL)', async () => {
    const f = jsonFetch({ response: { players: [] } });
    await expect(getPlayerSummary('765', 'k', f as never))
      .rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(getPlayerSummary('765', 'k', f as never))
      .rejects.not.toBeInstanceOf(PrivateProfileError);
  });

  it('API anahtarını sorgu dizesine koyar', async () => {
    const f = jsonFetch({
      response: {
        players: [
          {
            personaname: 'X',
            avatarfull: 'https://example.com/a.jpg',
            communityvisibilitystate: 1,
          },
        ],
      },
    });
    await getPlayerSummary('765', 'secret', f as never);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('key=secret');
    expect(url).toContain('steamids=765');
  });
});
