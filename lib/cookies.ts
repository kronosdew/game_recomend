/**
 * Uygulamanın kullandığı iki çerez. İkisi de httpOnly'dir (tarayıcıdaki
 * betikler okuyamaz) ve ikisi de aydınlatma metni §5'te açıkça anlatılır.
 */

/** Steam OpenID ile doğrulanmış oturum. Sahiplik KANITLANMIŞTIR. */
export const STEAM_ID_COOKIE = 'steam_id';
export const STEAM_ID_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * Link yapıştırma (deneme) modunda girilen profil adresi.
 *
 * Neden çerez, neden URL değil (I8): adres `/oneriler?profile=...` biçiminde
 * taşındığında sunucu erişim kayıtlarına, tarayıcı geçmişine ve `Referer`
 * başlığına düşüyordu. Spec §3.2 bu modun "hiçbir kişisel veri
 * kaydedilmez" olduğunu söylüyor; erişim kaydı bunu çürütüyordu. Form artık
 * POST eder, değer httpOnly çerezde taşınır ve kısa sürede kendiliğinden
 * düşer.
 *
 * Ömür bilerek kısadır: bu mod stateless bir denemedir, kalıcı bir oturum
 * değildir.
 */
export const DEMO_PROFILE_COOKIE = 'demo_profile';
export const DEMO_PROFILE_MAX_AGE_SECONDS = 10 * 60;
