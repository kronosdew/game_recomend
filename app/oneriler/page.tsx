import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/GameCard";
import { PrivacyHelp } from "@/components/PrivacyHelp";
import {
  produceRecommendations,
  recommendErrorCode,
  type RecommendErrorCode,
  type RecommendationResult,
} from "@/lib/server/recommendations";
import { logError } from "@/lib/log";
import { STEAM_ID_COOKIE, DEMO_PROFILE_COOKIE } from "@/lib/cookies";

function Sayfa({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-6">
        {children}
      </main>
    </div>
  );
}

function GeriDon() {
  return (
    <Button asChild variant="outline">
      <Link href="/">Ana sayfaya dön</Link>
    </Button>
  );
}

function Hata({
  baslik,
  children,
}: {
  baslik: string;
  children: ReactNode;
}) {
  return (
    <Sayfa>
      <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
      <Alert variant="destructive">
        <AlertTitle>{baslik}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
      <GeriDon />
    </Sayfa>
  );
}

export default async function OnerilerPage() {
  const cookieStore = await cookies();
  // Girişli hesap her zaman öncelikli; yoksa link yapıştırma (stateless demo).
  // Profil adresi artık URL'de DEĞİL, httpOnly çerezde taşınır (I8) — böylece
  // sunucu erişim kayıtlarına ve tarayıcı geçmişine düşmez.
  const profile =
    cookieStore.get(STEAM_ID_COOKIE)?.value ??
    cookieStore.get(DEMO_PROFILE_COOKIE)?.value;

  if (!profile) {
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">Profil seçilmedi</h1>
        <Alert>
          <AlertTitle>Henüz bir profil seçilmedi</AlertTitle>
          <AlertDescription>
            Öneri görebilmek için Steam ile giriş yapın ya da ana sayfadan bir
            profil linki girin.
          </AlertDescription>
        </Alert>
        <GeriDon />
      </Sayfa>
    );
  }

  // I7: öneri boru hattı burada DOĞRUDAN çağrılır. Sayfa eskiden kendi API
  // route'una APP_ORIGIN üzerinden bir HTTP isteği atıyordu; bu ağ turu
  // gereksiz, kırılgan (APP_ORIGIN yanlışsa sayfa çalışmaz) ve soğuk isteğin
  // süresine doğrudan katkı veriyordu. API route dışarıya açık kalır.
  let data: RecommendationResult | null = null;
  let hata: RecommendErrorCode | null = null;
  try {
    data = await produceRecommendations(profile);
  } catch (e) {
    hata = recommendErrorCode(e).code;
    if (hata === "unknown" || hata === "config_missing") {
      logError("page.oneriler", e, { code: hata });
    }
  }

  if (hata === "private_profile") {
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
        <PrivacyHelp />
        <GeriDon />
      </Sayfa>
    );
  }

  // R26: var olmayan hesaba ASLA gizlilik ayarı talimatı verilmez.
  if (hata === "profile_not_found") {
    return (
      <Hata baslik="Bu Steam profili bulunamadı">
        Girilen SteamID64 ile eşleşen bir Steam hesabı yok. Numarayı kontrol
        edin ya da profil adresinizi olduğu gibi yapıştırın.
      </Hata>
    );
  }

  if (hata === "vanity_not_found") {
    return (
      <Hata baslik="Profil bulunamadı">
        Bu özel adrese sahip profil bulunamadı.
      </Hata>
    );
  }

  if (hata === "invalid_url") {
    return <Hata baslik="Adres tanınamadı">Adresi kontrol edin.</Hata>;
  }

  if (hata === "upstream_timeout") {
    return (
      <Hata baslik="Steam şu anda yanıt vermiyor">
        İstek zaman aşımına uğradı. Bu geçici bir durum; birkaç dakika sonra
        tekrar deneyin.
      </Hata>
    );
  }

  if (hata === "config_missing") {
    return (
      <Hata baslik="Sunucu yapılandırması eksik">
        Lütfen daha sonra tekrar deneyin.
      </Hata>
    );
  }

  if (hata !== null || data === null) {
    // Belgelenmiş kodlardan biri değil — genel özür mesajı gösterilir,
    // dahili ayrıntı sızdırılmaz.
    return (
      <Hata baslik="Bir şeyler ters gitti">
        Lütfen daha sonra tekrar deneyin.
      </Hata>
    );
  }

  // I2: `count: 0` iki bambaşka durumu anlatır ve kullanıcıyı suçlamamalıdır.
  if (data.count === 0) {
    const katalogBos = data.poolSize === 0;
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">
          {katalogBos ? "Katalog henüz hazır değil" : "Sana uyan yeni çıkan bulunamadı"}
        </h1>
        <Alert>
          <AlertDescription>
            {katalogBos
              ? "Son 90 günün oyun kataloğu henüz doldurulmadı, bu yüzden " +
                "karşılaştıracak aday yok. Bu bizden kaynaklanıyor; kısa süre " +
                "sonra tekrar deneyin."
              : "Son 90 günde çıkan oyunlar arasında zevkinle örtüşen bir " +
                "şey bulamadık. Uydurma öneri vermektense boş liste " +
                "göstermeyi tercih ediyoruz; yeni oyunlar çıktıkça tekrar bakın."}
          </AlertDescription>
        </Alert>
        <GeriDon />
      </Sayfa>
    );
  }

  return (
    <Sayfa>
      <h1 className="text-2xl font-semibold">Sana önerdiklerimiz</h1>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        {data.recommendations.map((r) => (
          <GameCard
            key={r.appid}
            appid={r.appid}
            name={r.name}
            releaseDate={r.releaseDate}
            reason={r.reason}
            tags={r.tags}
          />
        ))}
      </div>
    </Sayfa>
  );
}
