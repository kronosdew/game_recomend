import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DraftLegalBanner } from "@/components/DraftLegalBanner";
import { CONSENT_TEXT_VERSION } from "@/lib/consent/versions";

export const metadata = {
  title: "Açık Rıza Metni — Steam Oyun Önerici",
  description:
    "6698 sayılı KVKK m.3/1-a uyarınca açık rıza metni (taslak).",
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

export default function AcikRizaMetniPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <DraftLegalBanner />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Açık Rıza Metni
          </h1>
          <p className="text-sm text-muted-foreground">
            Bu sayfa, KVKK m.3/1-a uyarınca aranan{" "}
            <strong>belirli, bilgilendirmeye dayalı ve özgür iradeyle
            verilmiş açık rıza</strong> beyanlarını açıklar. İşlenen veri
            kategorileri, işleme amacı ve hukuki sebep gibi genel
            bilgilendirme burada tekrarlanmaz; bunlar{" "}
            <Link href="/aydinlatma-metni" className="underline underline-offset-2">
              aydınlatma metninde
            </Link>{" "}
            yer alır. Bu metni okumadan önce aydınlatma metnini okumanız
            önerilir.
          </p>
        </div>

        <Bolum baslik="Şu anda (Faz 1) sizden hiçbir açık rıza istenmiyor">
          <p>
            Uygulamanın şu anki sürümü (&quot;Katman 0&quot;) — profilinizi
            okuma, öneri hesaplama, sonucu gösterme ve veriyi atma —
            KVKK m.5/2-c uyarınca sözleşmenin ifası temelinde çalışır. Bu
            işlem için açık rızanıza ihtiyaç yoktur ve şu anda size hiçbir
            onay kutusu bu amaçla sunulmamaktadır. Giriş ekranındaki onay
            kutusu bir rıza beyanı değil, yalnızca aydınlatma metnini
            okuduğunuzu doğrulayan bir bilgilendirme onayıdır.
          </p>
        </Bolum>

        <Bolum baslik="Katmanlı rıza modeli">
          <p>
            İleride eklenmesi planlanan özellikler, açık rıza gerektiren ayrı
            &quot;katmanlar&quot; hâlinde sunulacaktır. Her katman için onay{" "}
            <strong>ayrı ayrı</strong> istenecek; hiçbir zaman tek bir
            kutuda paketlenmeyecek, önceden işaretli gelmeyecek ve hizmet
            şartlarına ya da bu sayfadaki diğer katmanlara gömülmeyecektir.
            Aşağıdaki katmanların hiçbiri Faz 1&apos;de aktif değildir;
            burada yalnızca ne için, ileride nasıl onay isteneceği
            açıklanmaktadır — bu sayfayı okumanız hiçbirine şimdiden onay
            verdiğiniz anlamına gelmez.
          </p>
        </Bolum>

        <Bolum baslik="Katman 1 — Saklama (Faz 2)">
          <p>
            Profilinizin ve öneri geçmişinizin sunucuda saklanabilmesi
            (böylece her seferinde profilinizi yeniden okumak yerine geçmiş
            önerilerinizi görebilmeniz ve &quot;bunu bir daha gösterme&quot;
            gibi özellikleri kullanabilmeniz) için ayrı bir açık rızanız
            istenecektir.
          </p>
        </Bolum>

        <Bolum baslik="Katman 2 — E-posta Bildirimi (Faz 3)">
          <p>
            Beğeneceğiniz yeni çıkan oyunlar hakkında size e-posta ile
            bildirim gönderilebilmesi için ayrı bir açık rızanız
            istenecektir.
          </p>
        </Bolum>

        <Bolum baslik="Katman 3 — Anonimleştirilmiş Analitik (Faz 3)">
          <p>
            Kullanım verilerinizin, sizi tanımlamayacak şekilde
            anonimleştirilerek istatistiksel analizde kullanılabilmesi için
            ayrı bir açık rızanız istenecektir.
          </p>
        </Bolum>

        <Bolum baslik="Rızanın Geri Alınması">
          <p>
            Katman 1 veya sonrası için ileride verdiğiniz herhangi bir açık
            rızayı istediğiniz zaman, hiçbir gerekçe göstermeksizin geri
            çekebilirsiniz. Geri çekme talebiniz, o katmana ait işlemenin
            durdurulmasını sağlar ve daha önce hukuka uygun şekilde
            yapılmış işlemleri geçmişe etkili olarak hukuka aykırı hâle
            getirmez.
          </p>
          <p>
            Faz 2 itibarıyla, saklamaya ilişkin rızanızı doğrudan
            &quot;Verilerim&quot; sayfası üzerinden geri çekebilecek ve
            verilerinizin dışa aktarımını/kalıcı silinmesini
            isteyebileceksiniz. Bu sayfa henüz mevcut değildir; o zamana
            kadar geri çekme talepleriniz, aydınlatma metninde belirtilen
            [E-POSTA] veya [KEP ADRESİ veya BAŞVURU KANALI] üzerinden veri
            sorumlusuna iletilebilir.
          </p>
        </Bolum>

        <div className="flex flex-col gap-3 border-t pt-6">
          <p className="text-xs text-muted-foreground">
            Açık rıza metni sürüm: {CONSENT_TEXT_VERSION}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/aydinlatma-metni">Aydınlatma metnini görüntüle</Link>
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
