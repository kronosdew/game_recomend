export const MIN_PLAYTIME_MINUTES = 60;
export const RECENT_BOOST = 1.5;
export const NEGATIVE_WEIGHT = 0.3;
export const ABANDONED_MINUTES = 30;
export const ABANDONED_AFTER_SECONDS = 365 * 24 * 3600;

export const MIN_REVIEWS = 50;
export const MIN_POSITIVE_RATIO = 0.70;
export const RELEASE_WINDOW_DAYS = 90;

export const MMR_LAMBDA = 0.7;
export const MMR_K = 20;

// Sahip olunan oyunların SteamSpy meta verisini çekerken kullanılan sınırlar
// (R4): zevk vektörü en çok oynanan oyunlarca belirlendiği için 25 oyun
// yeterli sinyali taşır, ve SteamSpy ~1 istek/sn sınırına saygı için
// ardışık istekler arasında en az bu kadar boşluk bırakılır.
export const OWNED_GAMES_META_CAP = 25;

/**
 * Negatif sinyal (spec §6.6) için AYRI ve küçük bir meta verisi kotası (I1).
 *
 * Neden ayrı kota: OWNED_GAMES_META_CAP yalnızca `>= MIN_PLAYTIME_MINUTES`
 * oynanmış oyunlar arasından seçer; terk edilmiş oyun tanımı ise
 * `< ABANDONED_MINUTES` ister. İki küme AYRIK olduğu için negatif sinyalin
 * ihtiyaç duyduğu etiketler hiçbir zaman yüklenmiyor, §6.6 ölü kod kalıyordu.
 * Tek bir capi büyütmek yanlış çözüm olurdu: pozitif sinyalin bütçesini
 * düşük sinyalli oyunlara harcatır ve R4'ün gerekçesini (zevk vektörü en çok
 * oynanan oyunlarca belirlenir) bozardı. Bunun yerine negatif sinyale kendi
 * küçük bütçesi verilir — spec'in kendi deyimiyle "zayıf ama ücretsiz sinyal"
 * olduğu için bütçesi de küçük tutulur.
 */
export const ABANDONED_META_CAP = 10;
export const STEAMSPY_FETCH_SPACING_MS = 1100;
