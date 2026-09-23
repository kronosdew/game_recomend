export function PrivacyHelp() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-semibold">Steam profilinin oyun detayları gizli görünüyor.</p>
      <p className="mt-2">Öneri üretebilmek için kütüphaneni okuyabilmemiz gerekiyor:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Steam&apos;de profiline git</li>
        <li><strong>Profili Düzenle → Gizlilik Ayarları</strong></li>
        <li><strong>Oyun detayları</strong> → <strong>Herkese Açık</strong> yap</li>
        <li>Buraya dönüp tekrar dene</li>
      </ol>
      <p className="mt-2 text-muted-foreground">
        İstersen öneriyi aldıktan sonra ayarı tekrar gizliye çevirebilirsin.
      </p>
    </div>
  );
}
