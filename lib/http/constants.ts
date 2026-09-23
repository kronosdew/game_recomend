/**
 * Dış servislere yapılan her isteğin üst sınırı (milisaniye).
 *
 * Neden zorunlu: `fetch` varsayılan olarak SÜRESİZ bekler. Tek bir yavaş
 * Steam/SteamSpy yanıtı, tüm öneri isteğini (ve onu bekleyen sunucu iş
 * parçacığını) belirsiz süre kilitler. Soğuk bir istek zaten ~25-30 sn
 * sürebiliyor; sınırsız bekleme bunu tavansız hale getiriyordu.
 *
 * Değerler, gözlemlenen tipik gecikmelerin birkaç katı olacak şekilde
 * seçildi: normal çalışmada asla tetiklenmemeli, yalnızca gerçekten asılı
 * kalmış bir bağlantıyı kesmeli.
 */

/** Steam Web API (api.steampowered.com) — hızlı ve güvenilir uç noktalar. */
export const STEAM_API_TIMEOUT_MS = 10_000;

/** Steam Store `appdetails` — tek oyun, oran sınırına takılırsa yavaşlayabilir. */
export const STEAM_STORE_TIMEOUT_MS = 10_000;

/**
 * Steam Store arama uç noktası — sayfa başına 50 kayıt döndürdüğü için
 * appdetails'ten belirgin biçimde yavaş. Yalnızca cron'da (istek anında
 * değil) kullanılır, bu yüzden daha cömert.
 */
export const STEAM_SEARCH_TIMEOUT_MS = 20_000;

/** SteamSpy — üçüncü taraf, resmî değil; en oynak kaynak. */
export const STEAMSPY_TIMEOUT_MS = 10_000;
