import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/GameCard";
import { PrivacyHelp } from "@/components/PrivacyHelp";

interface Recommendation {
  appid: number;
  name: string;
  score: number;
  releaseDate: string;
  reason: string;
  tags: string[];
}

type RecommendResponse =
  | { count: number; recommendations: Recommendation[] }
  | { error: string };

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

export default async function OnerilerPage({ searchParams }: PageProps<"/oneriler">) {
  const sp = await searchParams;
  const profileParam = typeof sp.profile === "string" ? sp.profile : undefined;

  const cookieStore = await cookies();
  const steamId = cookieStore.get("steam_id")?.value;

  // Girişli hesap her zaman öncelikli; yoksa link yapıştırma (stateless demo) kullanılır.
  const profile = steamId ?? profileParam;

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

  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
        <Alert variant="destructive">
          <AlertTitle>Sunucu yapılandırması eksik</AlertTitle>
          <AlertDescription>Lütfen daha sonra tekrar deneyin.</AlertDescription>
        </Alert>
        <GeriDon />
      </Sayfa>
    );
  }

  let data: RecommendResponse;
  try {
    const res = await fetch(`${origin}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
      cache: "no-store",
    });
    data = (await res.json()) as RecommendResponse;
  } catch {
    data = { error: "unknown" };
  }

  if ("error" in data) {
    if (data.error === "private_profile") {
      return (
        <Sayfa>
          <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
          <PrivacyHelp />
          <GeriDon />
        </Sayfa>
      );
    }

    if (data.error === "vanity_not_found") {
      return (
        <Sayfa>
          <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
          <Alert variant="destructive">
            <AlertTitle>Profil bulunamadı</AlertTitle>
            <AlertDescription>
              Bu özel adrese sahip profil bulunamadı.
            </AlertDescription>
          </Alert>
          <GeriDon />
        </Sayfa>
      );
    }

    if (data.error === "invalid_url") {
      return (
        <Sayfa>
          <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
          <Alert variant="destructive">
            <AlertTitle>Adres tanınamadı</AlertTitle>
            <AlertDescription>Adresi kontrol edin.</AlertDescription>
          </Alert>
          <GeriDon />
        </Sayfa>
      );
    }

    // Belgelenmiş üç koddan biri değil (ör. 'unknown' ya da beklenmeyen bir
    // sunucu hatası) — genel özür mesajı gösterilir, dahili ayrıntı sızdırılmaz.
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">Öneri alınamadı</h1>
        <Alert variant="destructive">
          <AlertTitle>Bir şeyler ters gitti</AlertTitle>
          <AlertDescription>Lütfen daha sonra tekrar deneyin.</AlertDescription>
        </Alert>
        <GeriDon />
      </Sayfa>
    );
  }

  if (data.count === 0) {
    return (
      <Sayfa>
        <h1 className="text-2xl font-semibold">Öneri bulunamadı</h1>
        <Alert>
          <AlertTitle>Öneri bulunamadı</AlertTitle>
          <AlertDescription>
            Kütüphanenizde 60 dakikadan fazla oynanmış yeterli oyun
            bulamadık.
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
