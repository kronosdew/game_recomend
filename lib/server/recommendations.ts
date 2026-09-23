import { openDb, getCandidatePool } from '@/lib/catalog/db';
import { loadOwnedGamesMeta } from '@/lib/catalog/owned-games-meta';
import { getOwnedGames, getPlayerSummary } from '@/lib/steam/client';
import { resolveProfile, type ResolvedProfile } from '@/lib/steam/profile-url';
import { recommend } from '@/lib/recommend/pipeline';
import { logError } from '@/lib/log';
import {
  PrivateProfileError, ProfileNotFoundError, VanityNotFoundError,
  InvalidProfileUrlError, UpstreamTimeoutError,
} from '@/lib/steam/types';

/** Sunucu yapılandırması eksik (ör. STEAM_API_KEY yok). Kullanıcı hatası değildir. */
export class ServerConfigError extends Error {}

export interface RecommendationDto {
  appid: number;
  name: string;
  score: number;
  releaseDate: string;
  reason: string;
  tags: string[];
}

export interface RecommendationResult {
  count: number;
  /**
   * Kalite kapısını geçen aday sayısı (kullanıcıdan bağımsız, kamuya açık
   * katalog bilgisi). `count === 0` iki BAMBAŞKA duruma karşılık gelebilir
   * ve kullanıcıya doğru cümleyi kurabilmek için bunlar ayırt edilmelidir:
   * havuz boşsa suç sistemdedir (katalog henüz doldurulmamış), havuz doluysa
   * eşleşme bulunamamıştır. Bkz. I2.
   */
  poolSize: number;
  recommendations: RecommendationDto[];
}

export type RecommendErrorCode =
  | 'private_profile'
  | 'profile_not_found'
  | 'vanity_not_found'
  | 'invalid_url'
  | 'upstream_timeout'
  | 'config_missing'
  | 'unknown';

/**
 * Hata taksonomisinin TEK eşleme noktası. Hem API route hem sayfa buradan
 * geçer; ikisinin ayrı ayrı eşleme yapması, R10'un `ProfileNotFoundError`'ının
 * hiçbir kullanıcıya ulaşamamasının nedeniydi.
 */
export function recommendErrorCode(e: unknown): { code: RecommendErrorCode; status: number } {
  if (e instanceof PrivateProfileError) return { code: 'private_profile', status: 409 };
  if (e instanceof ProfileNotFoundError) return { code: 'profile_not_found', status: 404 };
  if (e instanceof VanityNotFoundError) return { code: 'vanity_not_found', status: 404 };
  if (e instanceof InvalidProfileUrlError) return { code: 'invalid_url', status: 400 };
  if (e instanceof UpstreamTimeoutError) return { code: 'upstream_timeout', status: 504 };
  if (e instanceof ServerConfigError) return { code: 'config_missing', status: 500 };
  return { code: 'unknown', status: 500 };
}

/**
 * Profil adresinden (ya da SteamID64'ten) öneri listesi üretir.
 *
 * Katman 0: hiçbir kişisel veri kaydedilmez. Yazılan tek şey
 * (loadOwnedGamesMeta içinde) kamuya açık oyun kataloğudur.
 */
export async function produceRecommendations(
  profile: string,
): Promise<RecommendationResult> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new ServerConfigError('STEAM_API_KEY tanımlı değil.');

  // Boru hattının TAMAMI tek bir saat okumasıyla çalışır. Ayrı ayrı
  // `new Date()` çağrıları, aday havuzunun yayın penceresi ile skorlamanın
  // güncellik katsayısının farklı anlara bakmasına yol açar (ve testten kaçar).
  const now = new Date();
  const nowSeconds = now.getTime() / 1000;

  const resolved = await resolveProfile(profile, apiKey);
  const games = await fetchOwnedGamesWithExistenceCheck(resolved, apiKey);

  // R4: en çok oynanan oyunlar + terk edilmiş oyunlar (I1) için meta veri
  // önce katalog önbelleğinden, yalnızca eksikler için SteamSpy'dan yüklenir.
  const db = openDb();
  const metaById = await loadOwnedGamesMeta(db, games, fetch, nowSeconds);

  const pool = getCandidatePool(db, now);
  const results = recommend({ games, metaById, pool, now });

  return {
    count: results.length,
    poolSize: pool.length,
    recommendations: results.map((r) => ({
      appid: r.meta.appid,
      name: r.meta.name,
      score: Number(r.score.toFixed(4)),
      releaseDate: r.meta.releaseDate,
      reason: r.explanation.text,
      tags: r.explanation.topTags,
    })),
  };
}

/**
 * R26 — "gizli profil" ile "böyle bir hesap yok"un ayrımı.
 *
 * Steam, VAR OLMAYAN bir oyuncu için de `GetOwnedGames`'te boş
 * `{"response":{}}` döndürür; yani iki durum ağ katmanında ayırt edilemez.
 * Ayrım yapılmadığında kullanıcı, hiç var olmayan bir hesap için
 * "Steam gizlilik ayarlarını değiştirin" talimatı görüyordu — hiçbir zaman
 * işe yaramayacak bir yönlendirme.
 *
 * Kontrol YALNIZCA ham-ID64 yolunda yapılır: vanity yolunda
 * `ResolveVanityURL` başarılı döndüyse profilin varlığı zaten kanıtlanmıştır
 * (bulunamayan özel adres `success: 42` verir), ek çağrı yalnızca gecikme olur.
 */
async function fetchOwnedGamesWithExistenceCheck(
  resolved: ResolvedProfile,
  apiKey: string,
) {
  try {
    return await getOwnedGames(resolved.steamId, apiKey);
  } catch (e) {
    if (e instanceof PrivateProfileError && resolved.kind === 'id64') {
      await assertProfileExists(resolved.steamId, apiKey);
    }
    throw e;
  }
}

/**
 * Profilin var olup olmadığını doğrular; yoksa `ProfileNotFoundError` fırlatır.
 *
 * KVKK NOTU — `GetPlayerSummaries` persona adı ve avatar adresi DÖNDÜRÜR ve
 * bir veriyi "elde etmek" de KVKK m.3/1-e anlamında işlemedir. Bu yüzden
 * dönen değer BİLEREK hiçbir değişkene atanmaz: kaydedilmez, loglanmaz,
 * yanıta konmaz ve kullanıcıya gösterilmez. Yanıttan yalnızca "kayıt var mı"
 * bilgisi kullanılır ve gerisi anında düşer. Aydınlatma metni §2 bu işlemeyi
 * açıkça anlatır — sessizce yapılmaz.
 */
async function assertProfileExists(steamId: string, apiKey: string): Promise<void> {
  try {
    await getPlayerSummary(steamId, apiKey);
  } catch (e) {
    if (e instanceof ProfileNotFoundError) throw e;
    // Varlık kontrolü kendisi başarısız oldu (ağ/zaman aşımı). Profilin
    // YOK olduğunu kanıtlayamadığımız için uydurmayız; çağıran orijinal
    // teşhisine (gizli profil) döner. Sessiz kalmamak için kaydedilir.
    logError('recommendations.existence-check', e);
  }
}
