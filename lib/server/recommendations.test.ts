import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { produceRecommendations, recommendErrorCode, ServerConfigError } from './recommendations';
import {
  PrivateProfileError, ProfileNotFoundError, VanityNotFoundError,
  InvalidProfileUrlError, UpstreamTimeoutError,
} from '@/lib/steam/types';

const YOK_OLAN_ID64 = '76561199999999999';
const VAR_OLAN_ID64 = '76561198000000001';

/**
 * Bu dosya BİLEREK entegrasyon seviyesindedir. C3'ün (R26) gözden kaçmasının
 * nedeni tam olarak buydu: `getPlayerSummary` kendi birim testinde doğru
 * çalışıyordu, `getOwnedGames` kendi biriminde doğru çalışıyordu, ama ikisi
 * BİRBİRİNE HİÇ BAĞLANMAMIŞTI — R10'un `ProfileNotFoundError`'ı hiçbir
 * kullanıcıya ulaşmıyordu. Burada ölçülen şey parçalar değil, DİKİŞ.
 */
function stubSteam(opts: {
  /** GetOwnedGames yanıtı. Varsayılan: gizli profil (boş response). */
  ownedGames?: unknown;
  /** GetPlayerSummaries yanıtı. Varsayılan: oyuncu bulundu. */
  players?: unknown[];
  /** ResolveVanityURL yanıtı. Varsayılan: başarılı. */
  vanity?: unknown;
} = {}) {
  const impl = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('ResolveVanityURL')) {
      return {
        ok: true,
        json: async () =>
          opts.vanity ?? { response: { success: 1, steamid: VAR_OLAN_ID64 } },
      };
    }
    if (u.includes('GetPlayerSummaries')) {
      return {
        ok: true,
        json: async () => ({ response: { players: opts.players ?? [{
          personaname: 'Gizli Kalmalı',
          avatarfull: 'https://example.com/a.jpg',
          communityvisibilitystate: 1,
        }] } }),
      };
    }
    if (u.includes('GetOwnedGames')) {
      return { ok: true, json: async () => opts.ownedGames ?? { response: {} } };
    }
    throw new Error(`Beklenmeyen istek: ${u}`);
  });
  vi.stubGlobal('fetch', impl);
  return impl;
}

const summaryCalls = (f: ReturnType<typeof stubSteam>) =>
  f.mock.calls.filter((c) => String(c[0]).includes('GetPlayerSummaries')).length;

beforeEach(() => {
  vi.stubEnv('STEAM_API_KEY', 'test-anahtari');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('produceRecommendations — var olmayan profil / gizli profil ayrımı (R26)', () => {
  it('ham ID64 + hesap YOK → ProfileNotFoundError (gizlilik talimatı DEĞİL)', async () => {
    const f = stubSteam({ players: [] });
    await expect(produceRecommendations(YOK_OLAN_ID64))
      .rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(produceRecommendations(YOK_OLAN_ID64))
      .rejects.not.toBeInstanceOf(PrivateProfileError);
    expect(summaryCalls(f)).toBeGreaterThan(0);
  });

  it('ham ID64 + hesap VAR ama kütüphane gizli → PrivateProfileError', async () => {
    const f = stubSteam();
    await expect(produceRecommendations(VAR_OLAN_ID64))
      .rejects.toBeInstanceOf(PrivateProfileError);
    expect(summaryCalls(f)).toBe(1);
  });

  it('vanity yolunda varlık kontrolü YAPILMAZ (gereksiz ağ turu)', async () => {
    const f = stubSteam();
    await expect(produceRecommendations('https://steamcommunity.com/id/birisi'))
      .rejects.toBeInstanceOf(PrivateProfileError);
    expect(summaryCalls(f)).toBe(0);
  });

  it('varlık kontrolü KENDİSİ başarısız olursa orijinal teşhise dönülür', async () => {
    // Profilin yok olduğunu kanıtlayamıyorsak uydurmayız.
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('GetPlayerSummaries')) {
        throw new Error('ağ koptu');
      }
      return { ok: true, json: async () => ({ response: {} }) };
    }));
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(produceRecommendations(VAR_OLAN_ID64))
        .rejects.toBeInstanceOf(PrivateProfileError);
      expect(hata).toHaveBeenCalled(); // sessizce yutulmaz (I10)
    } finally {
      hata.mockRestore();
    }
  });

  it('özel adres bulunamazsa VanityNotFoundError (profile_not_found ile karışmaz)', async () => {
    stubSteam({ vanity: { response: { success: 42 } } });
    await expect(produceRecommendations('https://steamcommunity.com/id/yok'))
      .rejects.toBeInstanceOf(VanityNotFoundError);
  });

  it('tanınmayan adres InvalidProfileUrlError', async () => {
    stubSteam();
    await expect(produceRecommendations('merhaba dünya'))
      .rejects.toBeInstanceOf(InvalidProfileUrlError);
  });

  it('STEAM_API_KEY yoksa ServerConfigError (kullanıcı hatası gibi gösterilmez)', async () => {
    vi.stubEnv('STEAM_API_KEY', '');
    stubSteam();
    await expect(produceRecommendations(VAR_OLAN_ID64))
      .rejects.toBeInstanceOf(ServerConfigError);
  });

  it('zaman aşımı UpstreamTimeoutError olur (sessizce 500 olmaz)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const e = new Error('zaman aşımı');
      e.name = 'TimeoutError';
      throw e;
    }));
    await expect(produceRecommendations('https://steamcommunity.com/id/birisi'))
      .rejects.toBeInstanceOf(UpstreamTimeoutError);
  });
});

describe('recommendErrorCode', () => {
  it.each([
    [new PrivateProfileError(), 'private_profile', 409],
    [new ProfileNotFoundError(), 'profile_not_found', 404],
    [new VanityNotFoundError(), 'vanity_not_found', 404],
    [new InvalidProfileUrlError(), 'invalid_url', 400],
    [new UpstreamTimeoutError(), 'upstream_timeout', 504],
    [new ServerConfigError(), 'config_missing', 500],
    [new Error('bilinmeyen'), 'unknown', 500],
  ])('%# → doğru kod ve HTTP durumu', (e, code, status) => {
    expect(recommendErrorCode(e)).toEqual({ code, status });
  });

  it('ProfileNotFoundError, PrivateProfileError ile AYNI koda düşmez', () => {
    // İkisi karışırsa kullanıcı var olmayan bir hesap için gizlilik ayarı
    // talimatı görür — C3'ün kullanıcıya ulaşan yüzü tam olarak buydu.
    expect(recommendErrorCode(new ProfileNotFoundError()).code)
      .not.toBe(recommendErrorCode(new PrivateProfileError()).code);
  });
});
