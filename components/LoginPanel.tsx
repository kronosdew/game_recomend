"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPanel() {
  const [consent, setConsent] = useState(false);
  const consentId = useId();
  const profileInputId = useId();

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <div className="flex flex-col gap-2">
        {/*
          Bu kutu RIZA değil, BİLGİLENDİRME onayıdır — sadece aydınlatma
          metninin okunduğunu doğrular. Faz 1 (profili oku, skorla, göster,
          unut) hiçbir veri saklamaz; işleme KVKK m.5/2-c (sözleşmenin ifası)
          temelinde yapılır, bu yüzden açık rıza gerekmez (bkz.
          lib/consent/versions.ts, ConsentLayer.Ephemeral). Açık rıza Faz
          2'nin konusudur (saklama/e-posta/analitik). Bu kutuyu yeniden bir
          "kabul ediyorum" onayına DÖNÜŞTÜRMEYİN ve açık rıza metnini bu
          kutunun etiketine EKLEMEYİN — iki belge KVKK m.10 ve m.3/1-a
          altında ayrı yükümlülüklerdir ve tek bir onaya indirgenemez.
        */}
        <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <input
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-foreground"
          />
          <label htmlFor={consentId}>
            <Link
              href="/aydinlatma-metni"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Aydınlatma metni
            </Link>
            {"'ni okudum ve anladım."}
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          Faz 1&apos;de hiçbir kişisel veri saklanmaz; bu nedenle bu aşamada
          rıza istenmez. Saklama, e-posta ya da analitik gibi ek kullanımlar
          için ileride ayrı ayrı isteneceği{" "}
          <Link
            href="/acik-riza"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            açık rıza metninde
          </Link>{" "}
          açıklanıyor.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Steam hesabınla giriş yap
        </h2>
        {consent ? (
          <Button asChild size="lg">
            <a href="/api/auth/steam">Steam ile Giriş Yap</a>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled
            title="Devam etmek için önce onay kutusunu işaretleyin"
          >
            Steam ile Giriş Yap
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        veya
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action="/oneriler" method="get" className="flex flex-col gap-2">
        <label htmlFor={profileInputId} className="text-sm font-medium text-muted-foreground">
          Profil linkini yapıştır (deneme modu)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={profileInputId}
            name="profile"
            placeholder="https://steamcommunity.com/id/kullaniciadi"
            required
            disabled={!consent}
          />
          <Button type="submit" variant="secondary" disabled={!consent}>
            Öner
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Link ile deneme modunda hiçbir veri kaydedilmez. Başkasının profilini
          girerseniz o kişi bu işleme onay vermemiş olur — kendi profilinizi girin.
        </p>
      </form>
    </div>
  );
}
