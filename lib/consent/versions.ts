/**
 * KVKK (6698 sayılı Kişisel Verilerin Korunması Kanunu) iki AYRI belge ister,
 * bu ikisi asla tek bir "doküman versiyonu"na indirgenmemelidir:
 *
 * - Aydınlatma metni (m.10): veri sorumlusunun kimliği, işlenen veri
 *   kategorileri, işleme amacı, hukuki sebep, saklama süresi, aktarım ve
 *   ilgili kişinin hakları. Bu yükümlülük rızadan bağımsız var olur.
 * - Açık rıza metni (m.3/1-a): belirli bir konuya ilişkin, bilgilendirilmiş
 *   ve özgür iradeyle verilmiş onay. Hizmet şartlarına gömülemez, önceden
 *   işaretli kutuyla alınamaz ve geri çekilebilir olmalıdır.
 *
 * Bu yüzden PRIVACY_NOTICE_VERSION ve CONSENT_TEXT_VERSION birbirinden
 * bağımsız iki sabittir ve birbiri cinsinden TANIMLANMAMALIDIR — biri
 * değiştiğinde diğerinin de değişmesi gerektiği hiçbir zaman doğru değildir.
 *
 * Metin her değiştiğinde ilgili versiyon ARTIRILIR. Eski versiyona verilmiş
 * bir onay yeni metni kapsamaz, çünkü kullanıcı o metni hiç görmedi — rıza
 * "bilgilendirilmiş" olma şartını (m.3/1-a) artık taşımaz. Bu yüzden
 * isConsentValid saklı kaydın textVersion'ını GÜNCEL versiyonla TAM EŞİTLİK
 * (===) ile karşılaştırır: ne eski ne de (henüz gösterilmemiş bir metne
 * ait olamayacağı için) gelecekteki bir versiyon kabul edilir. Bu kontrolü
 * kaldırıp yalnızca `granted: true` bakmak, kullanıcının hiç görmediği bir
 * metne rıza göstermiş gibi kaydedilmesi demektir — YAPMAYIN.
 */
export const PRIVACY_NOTICE_VERSION = 1; // aydınlatma metni (KVKK m.10)
export const CONSENT_TEXT_VERSION = 1; // açık rıza metni (KVKK m.3/1-a)

/**
 * Rıza katmanları. Rıza "özgülenmiş" (specific) olmalıdır: depolama, e-posta
 * ve analitik tek bir onay kutusunda toplanamaz. Bu yüzden her katman ayrı
 * ayrı sorgulanır — bir katman için verilmiş onay başka bir katmanı kapsamaz.
 */
export enum ConsentLayer {
  /**
   * Katman 0 — rıza katmanı DEĞİLDİR. Faz 1'de kullanıcı aktif olarak bir
   * öneri istediği için işleme KVKK m.5/2-c (sözleşmenin ifası) temelinde
   * yapılır; açık rıza gerekmez ve hiçbir kayıt tutulmaz. Katman sözlüğünün
   * eksiksiz olması için burada temsil edilir, kimse buna "rıza vermez".
   */
  Ephemeral = 'ephemeral',
  /** Katman 1 — profil ve öneri geçmişinin saklanması. */
  Storage = 'storage',
  /** Katman 2 — e-posta bildirimi. */
  Email = 'email',
  /** Katman 3 — anonimleştirilmiş analitik. */
  Analytics = 'analytics',
}

export interface ConsentRecord {
  layer: ConsentLayer;
  granted: boolean;
  textVersion: number;
}

/**
 * Verilen kaydın, sorulan katman için GEÇERLİ bir onay olup olmadığını
 * söyler. Geçerli sayılması için üçü de sağlanmalıdır: kayıt sorulan katmana
 * ait olmalı, `granted: true` olmalı ve `textVersion` GÜNCEL
 * CONSENT_TEXT_VERSION ile tam eşit olmalıdır (bkz. yukarıdaki not).
 */
export function isConsentValid(record: ConsentRecord, layer: ConsentLayer): boolean {
  if (record.layer !== layer) return false;
  if (!record.granted) return false;
  return record.textVersion === CONSENT_TEXT_VERSION;
}
