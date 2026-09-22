import type { Db } from './db';
import { upsertGameMeta } from './db';
import { fetchNewReleaseAppIds, fetchStoreDetails } from '@/lib/steam/store';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Yeni çıkanları toplayıp katalogu tazeler.
 * SteamSpy ~1 istek/sn, Store ~200 istek/5dk sınırına saygı duyar.
 */
export async function refreshCatalog(
  db: Db,
  opts: { pages?: number; delayMs?: number } = {},
): Promise<{ added: number; skipped: number; totalFound: number }> {
  const { pages = 4, delayMs = 1100 } = opts;
  const appIds = await fetchNewReleaseAppIds(fetch, pages);
  const totalFound = appIds.length;

  // Tarama hiçbir appid bulamadıysa bu neredeyse kesinlikle bir hatadır
  // (oran sınırlaması, erişim sorunu vb.) — sessiz bir "sakin hafta" değil.
  // Operatör, atlanan/eklenen sıfır olduğunda bunu sessizce "hiçbir yeni oyun
  // yok" ile karıştırmasın diye burada açıkça uyarılır.
  if (totalFound === 0) {
    console.warn(
      'Uyarı: Katalog taraması hiç appid bulamadı. Bu muhtemelen bir hata ' +
      '(oran sınırlaması veya erişim sorunu) — Steam\'de sessiz bir hafta olması beklenmez.',
    );
  }

  let added = 0;
  let skipped = 0;

  for (const appid of appIds) {
    try {
      const store = await fetchStoreDetails(appid);
      if (!store) { skipped++; continue; }
      await sleep(delayMs);

      const spy = await fetchSteamSpyTags(appid);
      // Etiketsiz oyun skorlanamaz — havuza alma.
      if (spy.tags.size === 0) { skipped++; continue; }

      const reviews = spy.positive + spy.negative;
      upsertGameMeta(db, {
        appid,
        name: store.name,
        tags: spy.tags,
        genres: store.genres,
        releaseDate: store.releaseDate,
        reviewCount: reviews,
        positiveRatio: reviews > 0 ? spy.positive / reviews : 0,
        owners: spy.owners,
      });
      added++;
    } catch {
      // Tek oyunun hatası tüm tazelemeyi düşürmesin.
      skipped++;
    }
    await sleep(delayMs);
  }
  return { added, skipped, totalFound };
}
