import type { Db } from './db';
import { getGameMetaByIds, upsertGameMeta } from './db';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';
import { isAbandoned } from '@/lib/recommend/user-vector';
import { logError } from '@/lib/log';
import {
  MIN_PLAYTIME_MINUTES, OWNED_GAMES_META_CAP, ABANDONED_META_CAP,
  STEAMSPY_FETCH_SPACING_MS,
} from '@/lib/recommend/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Zevk vektörü için kullanılacak oyunları seçer (R4): yalnızca yeterince
 * oynanmış (>= MIN_PLAYTIME_MINUTES) oyunlar, en çok oynanandan en aza doğru
 * sıralı, en fazla OWNED_GAMES_META_CAP tanesi. Zevk vektörü zaten en çok
 * oynanan oyunlarca domine edildiğinden bu kadarı yeterli sinyali taşır.
 */
export function selectRelevantOwnedGames(games: OwnedGame[]): OwnedGame[] {
  return games
    .filter((g) => g.playtime_forever >= MIN_PLAYTIME_MINUTES)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, OWNED_GAMES_META_CAP);
}

/**
 * Negatif sinyal (spec §6.6) adaylarını seçer: terk edilmiş oyunlar, EN ESKİ
 * dokunulandan başlayarak en fazla ABANDONED_META_CAP tanesi.
 *
 * En eskiden başlanır çünkü "bir yıldır dokunmadım" ile "üç yıldır
 * dokunmadım" aynı güçte sinyal değildir; bütçe sınırlıysa daha kesin olan
 * reddi almak doğrudur.
 *
 * Bu küme selectRelevantOwnedGames ile AYRIKTIR (biri >= 60 dk, diğeri
 * < 30 dk ister) — I1'in kökü buydu: tek bir seçim listesi negatif sinyalin
 * ihtiyaç duyduğu oyunları hiçbir zaman içermiyordu.
 */
export function selectAbandonedOwnedGames(
  games: OwnedGame[],
  nowSeconds: number,
): OwnedGame[] {
  return games
    .filter((g) => isAbandoned(g, nowSeconds))
    .sort((a, b) => (a.rtime_last_played ?? 0) - (b.rtime_last_played ?? 0))
    .slice(0, ABANDONED_META_CAP);
}

/**
 * Sahip olunan oyunların etiket meta verisini yükler. İki kümenin birleşimi
 * çekilir: pozitif sinyali taşıyan (en çok oynanan, sınırlı sayıdaki) oyunlar
 * ve negatif sinyali taşıyan (terk edilmiş, kendi küçük kotasıyla) oyunlar.
 *
 * Önce katalog önbelleğine bakılır (getGameMetaByIds — kalite kapısı ve yayın
 * penceresi burada uygulanmaz, ki bu doğrudur: sahip olunan oyunlar çoğunlukla
 * eski olur ve "son 90 gün" filtresini geçemez). Yalnızca önbellekte
 * bulunmayanlar için SteamSpy'a gidilir; SteamSpy ~1 istek/sn sınırına saygı
 * için istekler arasında en az STEAMSPY_FETCH_SPACING_MS boşluk bırakılır.
 * Tek bir oyunun hatası ya da boş etiket kümesi döndürmesi isteğin tamamını
 * düşürmez, o oyun atlanır (ve hata kaydedilir — sessizce yutulmaz).
 */
export async function loadOwnedGamesMeta(
  db: Db,
  games: OwnedGame[],
  fetchImpl: typeof fetch = fetch,
  nowSeconds: number = Date.now() / 1000,
): Promise<Map<number, GameMeta>> {
  const wanted = new Map<number, OwnedGame>();
  for (const g of selectRelevantOwnedGames(games)) wanted.set(g.appid, g);
  for (const g of selectAbandonedOwnedGames(games, nowSeconds)) wanted.set(g.appid, g);

  const relevant = [...wanted.values()];
  const metaById = getGameMetaByIds(db, relevant.map((g) => g.appid));
  const missing = relevant.filter((g) => !metaById.has(g.appid));

  for (let i = 0; i < missing.length; i++) {
    if (i > 0) await sleep(STEAMSPY_FETCH_SPACING_MS);
    const g = missing[i];
    try {
      const spy = await fetchSteamSpyTags(g.appid, fetchImpl);
      if (spy.tags.size === 0) continue; // etiketsiz oyun skorlanamaz/kullanılamaz

      const reviews = spy.positive + spy.negative;
      const meta: GameMeta = {
        appid: g.appid,
        name: g.name,
        tags: spy.tags,
        genres: [],
        // SteamSpy yayın tarihi vermez; sahip olunan oyunlar için kalite
        // kapısı/yayın penceresi zaten uygulanmadığından zararsızdır.
        releaseDate: '1970-01-01',
        reviewCount: reviews,
        positiveRatio: reviews > 0 ? spy.positive / reviews : 0,
        owners: spy.owners,
      };
      // Yalnızca kamuya açık katalog verisi (appid, isim, etiketler, ...)
      // yazılır — kimseyi tanımlayan hiçbir alan yok (Katman 0).
      upsertGameMeta(db, meta);
      metaById.set(g.appid, meta);
    } catch (e) {
      // Tek oyunun metadata hatası tüm isteği düşürmesin. appid kamuya açık
      // katalog bilgisidir, kişisel veri değildir — kayda alınması güvenlidir.
      logError('owned-games-meta.steamspy', e, { appid: g.appid });
      continue;
    }
  }

  return metaById;
}
