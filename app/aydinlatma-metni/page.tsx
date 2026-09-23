import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DraftLegalBanner } from "@/components/DraftLegalBanner";
import { PRIVACY_NOTICE_VERSION } from "@/lib/consent/versions";

export const metadata = {
  title: "Aydınlatma Metni — Steam Oyun Önerici",
  description:
    "6698 sayılı KVKK m.10 uyarınca aydınlatma metni (taslak).",
};

function Bolum({
  baslik,
  children,
}: {
  baslik: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{baslik}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function AydinlatmaMetniPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <DraftLegalBanner />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Aydınlatma Metni
          </h1>
          <p className="text-sm text-muted-foreground">
            6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
            m.10 uyarınca, Steam Oyun Önerici uygulamasını kullanırken
            işlenen kişisel verileriniz hakkında aşağıda bilgilendirme
            yapılmaktadır. Bu bilgilendirme rızanızdan bağımsızdır ve
            uygulamayı kullanan herkese, rıza verip vermediğine
            bakılmaksızın sunulur.
          </p>
        </div>

        <Bolum baslik="1. Veri Sorumlusunun Kimliği ve İletişim Bilgileri">
          <p>
            Bu uygulama kapsamında işlenen kişisel verilere ilişkin veri
            sorumlusu:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Unvan / ad-soyad: [VERİ SORUMLUSU: tam unvan]</li>
            <li>Adres: [ADRES]</li>
            <li>E-posta: [E-POSTA]</li>
            <li>
              KEP adresi / diğer resmî başvuru kanalı: [KEP ADRESİ veya
              BAŞVURU KANALI]
            </li>
            <li>VERBİS sicil numarası (varsa): [VERBİS SİCİL NUMARASI]</li>
          </ul>
        </Bolum>

        <Bolum baslik="2. İşlenen Kişisel Veri Kategorileri">
          <p>Uygulama, kütüphanenizdeki oyunlara göre öneri üretebilmek için:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Steam kullanıcı kimliğinizi (SteamID64)</strong> —
              Steam ile giriş yaptığınızda Steam&apos;in kendi kimlik
              doğrulama akışından (OpenID) elde edilir; profil linki
              yapıştırma modunda ise girdiğiniz linkten (gerekirse Steam
              üzerinden özel adres çözümlemesiyle) elde edilir,
            </li>
            <li>
              <strong>sahip olduğunuz oyunların listesi ve her oyundaki
              oynama sürenizi (dakika cinsinden)</strong> — yalnızca öneri
              hesaplanırken okunur.
            </li>
          </ul>
          <p>
            Uygulama arkadaş listenizi <strong>hiçbir şekilde talep etmez ve
            işlemez</strong> — bkz. madde 6.
          </p>
          <p>
            <strong>Profil varlık kontrolü.</strong> Adres yerine doğrudan bir
            SteamID64 girdiğinizde, numaranın gerçekten bir Steam hesabına ait
            olup olmadığı Steam&apos;in{" "}
            <code className="rounded bg-muted px-1">GetPlayerSummaries</code>{" "}
            servisine sorularak doğrulanır. Bu kontrol olmadan, var olmayan bir
            numara için size &quot;profiliniz gizli, gizlilik ayarlarınızı
            değiştirin&quot; denirdi; çünkü Steam her iki durumda da aynı boş
            yanıtı veriyor.
          </p>
          <p>
            Bu servisin yanıtı <strong>görünen adınızı (persona name) ve avatar
            adresinizi de içerir</strong>. Bu verileri talep etmiyoruz ancak
            yanıtın içinde bize ulaşıyorlar; KVKK anlamında bir veriyi elde
            etmek de işlemedir, bu yüzden burada açıkça belirtiyoruz. Bu
            veriler <strong>okunmaz, kullanılmaz, hiçbir yere kaydedilmez,
            günlük (log) kayıtlarına yazılmaz ve size veya başkasına
            gösterilmez</strong>; yanıttan yalnızca &quot;böyle bir hesap var
            mı&quot; bilgisi alınır ve gerisi işlem biter bitmez bellekten
            düşer. Profil adresi (özel adres) girdiğinizde bu kontrol{" "}
            <strong>hiç yapılmaz</strong>: adresin çözümlenmiş olması hesabın
            varlığını zaten kanıtlar.
          </p>
          <p>
            Ayrıca uygulama, herkese açık Steam oyun kataloğundan (uygulama
            kimliği, isim, etiketler, çıkış tarihi, inceleme sayıları)
            oluşan yerel bir önbellek tutar. Bu önbellek yalnızca kamuya açık
            oyun bilgisi içerir, hiçbir kullanıcıya ait bilgi barındırmaz ve
            bu nedenle kişisel veri değildir.
          </p>
        </Bolum>

        <Bolum baslik="3. İşleme Amacı">
          <p>
            Yukarıdaki veriler, yalnızca aktif olarak talep ettiğiniz oyun
            önerisini üretmek amacıyla işlenir. Başka bir amaçla (reklam,
            profilleme, üçüncü kişilerle paylaşım vb.) kullanılmaz.
          </p>
        </Bolum>

        <Bolum baslik="4. Hukuki Sebep">
          <p>
            Uygulamanın şu anki sürümünde (Faz 1 / &quot;Katman 0&quot;)
            veri işleme, KVKK m.5/2-c uyarınca{" "}
            <strong>bir sözleşmenin kurulması veya ifasıyla doğrudan
            doğruya ilgili olması</strong> hukuki sebebine dayanır: öneriyi
            siz talep edersiniz, uygulama bu talebi yerine getirmek için
            kütüphanenizi bir kereliğine okur. Bu işlem için açık rızanız
            aranmaz.
          </p>
          <p>
            İleride eklenmesi planlanan ek özellikler (profilinizin
            saklanması, e-posta bildirimi, anonimleştirilmiş analitik) ise
            açık rızanıza dayanacaktır ve her biri için ayrı ayrı, aşağıda
            bahsedilen{" "}
            <Link
              href="/acik-riza"
              className="underline underline-offset-2"
            >
              açık rıza metni
            </Link>{" "}
            üzerinden onayınız istenecektir.
          </p>
        </Bolum>

        <Bolum baslik="5. Saklama Süresi">
          <p>
            Uygulamanın şu anki sürümünde kişisel veriniz{" "}
            <strong>saklanmaz</strong>: kütüphaneniz okunur, öneri hesaplanır,
            sonuç size gösterilir ve veri bellekten düşer. Kişisel verinizin
            hiçbir kaydı veritabanına yazılmaz.
          </p>
          <p>
            İstisna, yalnızca <strong>kendi tarayıcınızda</strong> tutulan ve
            tarayıcı tarafından okunamayan (httpOnly) iki çerezdir. İkisi de
            sunucuda saklanmaz, üçüncü kişiye gönderilmez ve süresi dolduğunda
            kendiliğinden geçersiz olur:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Steam ile giriş yaptığınızda, oturumunuzu tutmak için
              SteamID64&apos;ünüzü içeren bir oturum çerezi{" "}
              <strong>8 saat</strong> süreyle tutulur.
            </li>
            <li>
              Profil linki yapıştırma (deneme) modunda, girdiğiniz adres{" "}
              <strong>10 dakika</strong> süreyle bir çerezde tutulur. Adres
              bilerek adres çubuğuna yazılmaz: aksi hâlde sunucu erişim
              kayıtlarına, tarayıcı geçmişinize ve dış bağlantılara
              gönderilen <code className="rounded bg-muted px-1">Referer</code>{" "}
              başlığına düşerdi.
            </li>
          </ul>
        </Bolum>

        <Bolum baslik="6. Arkadaş Listesi İşlenmez">
          <p>
            Uygulama Steam arkadaş listenizi hiçbir şekilde okumaz veya
            işlemez. Bunun nedeni teknik değil hukukidir: arkadaşlarınız bu
            işleme rıza vermemiştir ve veremez; bu yüzden üçüncü kişilere ait
            hiçbir veri işlenmez.
          </p>
        </Bolum>

        <Bolum baslik="7. Veri Aktarımı">
          <p>
            Kişisel verileriniz herhangi bir üçüncü kişiye
            <strong> aktarılmaz</strong>. Uygulama, önerinizi
            hesaplayabilmek için Steam&apos;in kendi API&apos;lerine
            (SteamID64&apos;ünüzü kullanarak) ve SteamSpy&apos;a (yalnızca
            oyunların herkese açık uygulama kimlikleriyle, kullanıcıya ait
            hiçbir bilgi göndermeden) sorgu yapar. Bu, verinizin zaten
            bulunduğu kaynaktan (Steam) okunmasıdır; verinizin bir üçüncü
            kişiye aktarılması değildir.
          </p>
        </Bolum>

        <Bolum baslik="8. KVKK m.11 Kapsamındaki Haklarınız">
          <p>KVKK m.11 uyarınca veri sorumlusuna başvurarak:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>kişisel verinizin işlenip işlenmediğini öğrenme,</li>
            <li>işlenmişse buna ilişkin bilgi talep etme,</li>
            <li>
              işlenme amacını ve amacına uygun kullanılıp kullanılmadığını
              öğrenme,
            </li>
            <li>
              yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme,
            </li>
            <li>
              eksik/yanlış işlenmişse düzeltilmesini isteme,
            </li>
            <li>
              KVKK m.7&apos;deki şartlar oluştuğunda silinmesini/yok
              edilmesini isteme,
            </li>
            <li>
              yapılan işlemlerin, verinin aktarıldığı üçüncü kişilere
              bildirilmesini isteme,
            </li>
            <li>
              münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir
              sonucun ortaya çıkmasına itiraz etme,
            </li>
            <li>
              kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde
              zararın giderilmesini talep etme
            </li>
          </ul>
          <p>
            haklarına sahipsiniz. Başvurunuzu, veri sorumlusunun 1.
            maddede belirtilen [E-POSTA] veya [KEP ADRESİ veya BAŞVURU
            KANALI] üzerinden iletebilirsiniz.
          </p>
        </Bolum>

        <div className="flex flex-col gap-3 border-t pt-6">
          <p className="text-xs text-muted-foreground">
            Aydınlatma metni sürüm: {PRIVACY_NOTICE_VERSION}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/acik-riza">Açık rıza metnini görüntüle</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Ana sayfaya dön</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
