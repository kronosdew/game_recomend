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
export const STEAMSPY_FETCH_SPACING_MS = 1100;
