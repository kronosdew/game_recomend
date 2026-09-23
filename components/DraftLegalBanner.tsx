import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/**
 * Bu iki hukuki metin (aydınlatma metni, açık rıza metni) proje sahibinin
 * gerçek kimlik/iletişim bilgisini gerektirir; bunlar kodla üretilemez ve
 * uydurulamaz (bkz. task-15 brief). Bu banner o yüzden var: köşeli parantez
 * içindeki yer tutucular doldurulup bir hukukçuya okutulmadan bu sayfalar
 * yayına ALINMAMALIDIR. Banner metinden kaldırılmamalı.
 */
export function DraftLegalBanner() {
  return (
    <Alert variant="destructive" className="w-full">
      <AlertTitle>TASLAK — yayına hazır değil</AlertTitle>
      <AlertDescription>
        <p>
          Bu sayfa bir <strong>taslaktır</strong>. Köşeli parantez içinde{" "}
          <code>[BÜYÜK HARFLİ]</code> yazan her ifade (ör. [VERİ SORUMLUSU: tam
          unvan], [ADRES]) proje sahibi / veri sorumlusu tarafından gerçek
          bilgiyle doldurulmadan bu sayfa yayına alınmamalıdır.
        </p>
        <p>
          Ayrıca metin, yayına çıkmadan önce bir hukukçu tarafından
          incelenmelidir. Bu sayfayı hazırlayan yapay zekâ avukat değildir ve
          burada uydurma bir tüzel kişi, adres, e-posta ya da sicil numarası
          bulunmamaktadır — yalnızca doldurulması gereken alanlar
          işaretlenmiştir.
        </p>
      </AlertDescription>
    </Alert>
  );
}
