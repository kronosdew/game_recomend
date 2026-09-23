import type { Db } from './db';
import { upsertGameMeta } from './db';
import { fetchNewReleaseAppIds, fetchStoreDetails } from '@/lib/steam/store';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';
import { logError } from '@/lib/log';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Yeni çıkanları toplayıp katalogu tazeler.
 * SteamSpy ~1 istek/sn, Store ~200 istek/5dk sınırına saygı duyar.
 *
 * KADANS (I3) — spec §6.2 aday havuzunun 90 GÜNLÜK bir pencereyi kapsamasını
 * ister; tek bir çalıştırma bunu YAPAMAZ:
 *
 * - Varsayılan `pages = 4`, Store aramasından (sayfa başına 50 kayıt) en çok
 *   200 appid tarar. Bunlar çıkış tarihine göre AZALAN sıradadır, yani her
 *   çalıştırma yalnızca EN YENİ ~200 sürümü görür.
 * - Steam'e günde ~50 oyun çıkıyor; 200 kayıt kabaca son 4 GÜNE karşılık
 *   gelir. Daha seyrek çalıştırmak pencerede delik bırakır.
 * - Bu yüzden ÖNERİLEN KADANS: GÜNDE EN AZ BİR KEZ (`pages = 4`). Günlük
 *   çalışmada 90 günlük pencere ~90 çalıştırmada dolar ve sonra kendini
 *   günceller; katalog boşken ilk doldurma için `pages` geçici olarak
 *   yükseltilmelidir (ör. 40 sayfa = ~2000 kayıt ≈ 40 gün) ya da script
 *   birkaç gün üst üste çalıştırılmalıdır.
 * - Süre tahmini: her appid için 2 istek ve 2 × `delayMs` bekleme vardır,
 *   yani `pages = 4` ≈ 200 × 2.2 sn ≈ 7-8 dakika. `delayMs` DÜŞÜRÜLMEMELİDİR;
 *   oran sınırını tetikleyen tam olarak budur.
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
    } catch (e) {
      // Tek oyunun hatası tüm tazelemeyi düşürmesin — ama sessizce yutulmasın
      // (I10): appid kamuya açık katalog bilgisidir, kişisel veri değildir.
      logError('catalog.refresh', e, { appid });
      skipped++;
    } finally {
      // Her çıkış yolunda (erken `continue`, hata, ya da başarı) en az bir kez
      // duraklatır. `continue` bir `finally` bloğunu atlamaz — bu, art arda
      // gelen oyun-olmayan appid'lerde (DLC, soundtrack, henüz çıkmamış)
      // Store'a duraksız istek dizisi göndermeyi önler, ki oran sınırını
      // tetikleyen tam olarak budur.
      await sleep(delayMs);
    }
  }
  return { added, skipped, totalFound };
}
