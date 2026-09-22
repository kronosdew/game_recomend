import type { Db } from './db';
import { getGameMetaByIds, upsertGameMeta } from './db';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';
import {
  MIN_PLAYTIME_MINUTES, OWNED_GAMES_META_CAP, STEAMSPY_FETCH_SPACING_MS,
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
 * Sahip olunan (en çok oynanan, sınırlı sayıdaki) oyunların etiket meta
 * verisini yükler. Önce katalog önbelleğine bakılır (getGameMetaByIds —
 * kalite kapısı ve yayın penceresi burada uygulanmaz, ki bu doğrudur: sahip
 * olunan oyunlar çoğunlukla eski olur ve "son 90 gün" filtresini geçemez).
 * Yalnızca önbellekte bulunmayanlar için SteamSpy'a gidilir; SteamSpy
 * ~1 istek/sn sınırına saygı için istekler arasında en az
 * STEAMSPY_FETCH_SPACING_MS boşluk bırakılır. Tek bir oyunun hatası ya da
 * boş etiket kümesi döndürmesi isteğin tamamını düşürmez, o oyun atlanır.
 */
export async function loadOwnedGamesMeta(
  db: Db,
  games: OwnedGame[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<number, GameMeta>> {
  const relevant = selectRelevantOwnedGames(games);
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
    } catch {
      continue; // tek oyunun metadata hatası tüm isteği düşürmesin
    }
  }

  return metaById;
}
