# Global Sürüm + Arkadaş Grubu — Uygulama Planı

Spec: `docs/superpowers/specs/2026-09-27-global-grup-surumu-design.md`
Dal: `claude/setup-plugins-project-3uhrtq`
Yürütme: subagent başına bir görev, her görevden sonra inceleme.

## Global kısıtlar (her göreve uygulanır)

1. **Next.js 16.3.5.** `node_modules/next/dist/docs/` okunacak. Doğrulanmış:
   `middleware.ts` deprecated → `proxy.ts`; `next/root-params` `lang()` getter'ı
   Server Component'lerde çalışır, Client Component / Server Action / Route
   Handler'da çalışmaz.
2. **Mutasyon doğrulaması (R15).** Her guard için: kır, testin kırıldığını gör,
   geri al. Geçen test davranış kanıtı değildir.
3. `lib/recommend` **saf** kalır: I/O yok, string üretimi yok, `Date.now()` yok.
4. Kişisel veri diske yazılmaz. Arkadaş verisi loga da yazılmaz.
5. `STEAM_API_KEY` yalnızca sunucuda, asla `NEXT_PUBLIC_`, asla loglanmaz.
6. Her görev sonunda: `vitest run`, `tsc --noEmit`, `lint`, `build` temiz.
7. Commit'i implementer atar; PR açılmaz.

## FAZ A — Temel

### A1. i18n iskeleti
`app/[lang]/` altına taşıma; `proxy.ts` (Accept-Language → 307); bağımlılıksız
saf `negotiate()`; `getDictionary()` (`next/root-params`); `en` + `tr` sözlükleri;
`generateStaticParams` 10 dil; sözlük anahtar bütünlüğü testi (`en` kanonik).
Mevcut tüm Türkçe stringler sözlüğe çıkarılır.

### A2. Dark OLED tasarım sistemi
`globals.css` token'ları `@layer base` içinde; shadcn bileşenlerinin yeniden
teması; `prefers-reduced-motion`; focus halkaları; CJK font zinciri.
Hesaplanmış kontrast oranı testi (gövde ≥7:1, ikincil ≥4.5:1).

### A3. `explain.ts` yapısal sözleşme
String üretimi kaldırılır, `Explanation` birleşim tipi döner (spec §2.4).
Sunum katmanında sözlük şablonlu formatlayıcı + `Intl.PluralRules`.
Mevcut `explain.test.ts` yapıya göre yeniden yazılır.

### A4. Ekranların yeniden yapımı
Anasayfa, `/oneriler` (tüm hata dalları dahil), yeni temada ve sözlükle.
Tek `h1`, etiketli form alanları, 375/768/1024/1440 doğrulaması.

### A5. Rıza kapısı kaldırma + privacy notice
Onay kutusu ve iki KVKK sayfası kaldırılır; tek `/[lang]/privacy` gelir.
EN authoritative, sayfada belirtilir. Taslak bandı ve placeholder'lar korunur.
`lib/consent/versions.ts` sadeleşir veya kalkar.

### A6. Kalan 8 dil
`de, fr, es, pt-BR, ru, zh-Hans, ja, ko` sözlükleri + gerekçe şablonları.
Her dosyada `"_meta": { "reviewed": false }`. Bütünlük testi geçmeli.

## FAZ B — Arkadaş grubu

### B1. Çok oyunculu metadata + şema migrasyonu
`store.ts` `categories` çeker; `GameMeta.categories`; `categories_json` kolonu;
`PRAGMA user_version` v0→v1 `ALTER TABLE`; `isMultiplayer` / `isCoop` saf
yardımcıları. Migrasyon testi: v0 DB açılır, kolon eklenir, satırlar korunur.

### B2. Arkadaş listesi istemcisi
`GetFriendList` + toplu `GetPlayerSummaries` (≤100/istek).
`FriendListPrivateError`. Yalnızca OpenID oturumu; demo modunda 403.

### B3. Grup skorlama (saf)
`groupScore = 0.6*mean + 0.4*min` normalize skorlar üzerinde; `coverage`;
sıralama kuralları (spec §5.4). `min` teriminin etkisini kanıtlayan test.

### B4. Grup boru hattı
Üye başına `GetOwnedGames`, gizli profilli üyeyi **düşür ve devam et**,
iki sekmenin veri kümelerini üret. Arkadaş verisi diske/loga yazılmaz.

### B5. Arkadaş seçim ekranı
Persona + avatar, ≤10 seçim, seçilmeyen veri atılır.

### B6. İki sekmeli sonuç ekranı
Tam kapsananlar üstte ayrı blok; eksikler "kimde yok" adıyla; gerekçeler;
sekme 2 kalite kapısı + MMR + skor tabanı.

### B7. Hata yolları ve son geçiş
Düşen üyeler, boş grup, gizli arkadaş listesi, demo kısıtı; uçtan uca
çalışma zamanı doğrulaması.
