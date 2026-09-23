/**
 * Sunucu tarafı yapılandırılmış hata kaydı.
 *
 * GİZLİLİK SÖZLEŞMESİ — bu fonksiyona ASLA şunlar geçilmez:
 * Steam API anahtarı, profil adresi, SteamID64, persona adı, avatar adresi
 * ya da kullanıcının oyun listesi. Kayıt yalnızca "nerede, ne tür bir hata"
 * sorusunu yanıtlar; "kime ait" sorusunu yanıtlamaz. `scope` sabit bir
 * dizgedir (çağrı yerinin adı), `detail` ise yalnızca kişisel veri
 * içermediği çağrı yerinde kanıtlanmış alanlar taşır (ör. appid).
 *
 * Neden var: bu kod tabanındaki `catch {}` blokları hataları sessizce
 * yutuyordu; üretimde "öneri gelmiyor" şikâyetinin nedeni hiçbir yerde
 * görünmüyordu.
 */
export function logError(
  scope: string,
  error: unknown,
  detail: Record<string, string | number | boolean> = {},
): void {
  const name = error instanceof Error ? error.name : typeof error;
  const message = scrub(error instanceof Error ? error.message : String(error));
  console.error(
    JSON.stringify({
      level: 'error',
      scope,
      error: name,
      message,
      ...detail,
      at: new Date().toISOString(),
    }),
  );
}

/**
 * Son savunma hattı: bir hata mesajı beklenmedik şekilde bir sorgu dizesi
 * taşırsa (ör. düşük seviyeli bir ağ hatası) API anahtarı ve SteamID64
 * kayda düşmesin. Çağrı yerlerinin zaten temiz mesajlar üretmesi esastır;
 * bu yalnızca sessizce yanlış gitmeyi engeller.
 */
function scrub(message: string): string {
  return message
    .replace(/(key=)[^&\s]+/gi, '$1[GİZLENDİ]')
    .replace(/(steamids?=)[^&\s]+/gi, '$1[GİZLENDİ]')
    .replace(/7656119\d{10}/g, '[STEAMID]');
}
