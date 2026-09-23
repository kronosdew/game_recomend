import { LoginPanel } from "@/components/LoginPanel";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const HATA_MESAJLARI: Record<string, string> = {
  giris: "Steam girişi doğrulanamadı. Lütfen tekrar deneyin.",
  adres: "Girdiğiniz adres bir Steam profil adresine benzemiyor. Örnek: https://steamcommunity.com/id/kullaniciadi",
  bilinmeyen: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const hataParam = typeof sp.hata === "string" ? sp.hata : undefined;
  const hataMesaji = hataParam ? HATA_MESAJLARI[hataParam] : undefined;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Steam Oyun Önerici</h1>
          <p className="text-muted-foreground">
            Steam kütüphaneni okuyup oynama alışkanlıklarına göre sana uygun,
            az bilinen oyunlar öneririz.
          </p>
        </div>

        {hataMesaji && (
          <Alert variant="destructive" className="w-full">
            <AlertTitle>
              {hataParam === "adres" ? "Adres tanınamadı" : "Giriş başarısız"}
            </AlertTitle>
            <AlertDescription>{hataMesaji}</AlertDescription>
          </Alert>
        )}

        <LoginPanel />

        <p className="text-center text-xs text-muted-foreground">
          Faz 1&apos;de kişisel veriniz saklanmaz; öneri anlık üretilir ve
          ardından unutulur.
        </p>
      </main>
    </div>
  );
}
