/**
 * Katalog tazeleme betiği — `npm run refresh:catalog`
 *
 * NE YAPAR: Steam Store'un "yeni çıkanlar" aramasını tarar, her appid için
 * Store detaylarını ve SteamSpy etiketlerini çeker, kalite kapısını geçenleri
 * yerel SQLite kataloğuna yazar. Yalnızca KAMUYA AÇIK oyun verisi yazılır;
 * hiçbir kullanıcı verisi bu betikten geçmez.
 *
 * KADANS — spec §6.2, aday havuzunun son 90 GÜNÜ kapsamasını ister.
 * Tek çalıştırma bunu sağlamaz:
 *
 *   | Ayar                | Taranan appid | Kabaca kapsanan | Süre      |
 *   |---------------------|---------------|-----------------|-----------|
 *   | `pages = 4` (vars.) | ~200          | son ~4 gün      | ~7-8 dk   |
 *   | `pages = 40`        | ~2000         | son ~40 gün     | ~75 dk    |
 *
 * (Steam'e günde ~50 oyun çıkıyor; Store araması çıkış tarihine göre AZALAN
 * sıralı döner, yani her çalıştırma yalnızca en yeni N sürümü görür.)
 *
 *   - RUTİN: GÜNDE EN AZ BİR KEZ, varsayılan `pages = 4` ile. Günlük
 *     çalışmada 90 günlük pencere birikerek dolar ve kendini günceller.
 *     Bir günü atlarsan o güne ait çıkışlar pencereye HİÇ girmez.
 *   - İLK DOLDURMA: katalog boşken tek seferlik `CATALOG_PAGES=40` (ya da
 *     daha fazla) ile çalıştır; ardından günlük rutine dön.
 *   - `delayMs` (varsayılan 1100 ms) DÜŞÜRÜLMEMELİDİR: SteamSpy ~1 istek/sn,
 *     Store ~200 istek/5 dk sınırına sahiptir ve oran sınırını tetikleyen
 *     tam olarak bu bekleme süresinin kısaltılmasıdır.
 *
 * Örnek cron (her gün 04:30):
 *   30 4 * * *  cd /uygulama && npm run refresh:catalog >> /var/log/katalog.log 2>&1
 */
import { openDb } from '@/lib/catalog/db';
import { refreshCatalog } from '@/lib/catalog/refresh';

const pages = Number(process.env.CATALOG_PAGES ?? 4);

const db = openDb();
refreshCatalog(db, { pages })
  .then((r) => {
    console.log(
      `Katalog tazelendi: +${r.added}, atlanan ${r.skipped}, taranan ${r.totalFound}`,
    );
  })
  .catch((e) => { console.error(e); process.exit(1); });
