# Global Sürüm + Arkadaş Grubu — Spec

**Durum:** Onaylandı (2026-09-27) — kullanıcı "sadece sistemi bitir" talimatı verdi
**Önceki spec:** `steam-oyun-onerici.md` yürürlükte kalır; bu belge onu değiştirdiği
yerleri açıkça sayar.

## 0. Bu belgenin değiştirdikleri

| Önceki spec | Yeni durum |
|---|---|
| §2 "Arkadaş listesi kullanılmaz" | **İPTAL.** Arkadaş listesi çekilir (§5). |
| §4.1/§4.2 rıza kapısı, iki ayrı KVKK belgesi | **İPTAL.** Rıza kapısı kaldırılır; tek çok dilli privacy notice (§4). |
| Tek dil (Türkçe) | 10 dil (§2). |
| Açık tema | Dark Mode (OLED) (§3). |

Değişmeyen: kişisel veri diske yazılmaz; katalog cache kişisel veri değildir;
`lib/recommend` saf kalır; Steam API anahtarı yalnızca sunucuda.

## 1. Amaç

Global, 10 dilli, koyu temalı bir Steam öneri sitesi. İki yetenek:
tek kişi için yeni çıkan önerisi (mevcut) ve seçilen arkadaşlarla
birlikte oynanabilecek oyunlar (yeni).

## 2. Uluslararasılaştırma

### 2.1 Diller

`en` (varsayılan), `tr`, `de`, `fr`, `es`, `pt-BR`, `ru`, `zh-Hans`, `ja`, `ko`.

### 2.2 Yönlendirme

Next.js 16 konvansiyonu. **`middleware.ts` bu sürümde deprecated; `proxy.ts`
kullanılır.**

- Tüm rotalar `app/[lang]/` altına taşınır.
- `proxy.ts` yol öneki içermeyen istekte `Accept-Language` başlığını okur,
  desteklenen dile eşler, `/<lang><path>`e 307 yönlendirir.
- Dil eşlemesi bağımlılıksız yazılır (küçük bir `negotiate()` saf fonksiyonu):
  q-değerlerine göre sırala, tam eşleşme → temel dil eşleşmesi → varsayılan.
- `generateStaticParams` 10 dili döndürür.

### 2.3 Sözlükler

- `app/[lang]/dictionaries/<lang>.json`, dinamik `import()` ile yüklenir.
- `getDictionary()` dili `next/root-params`'tan (`lang()`) okur; prop drilling yok.
  `next/root-params` Server Component'lerde çalışır; **Client Component, Server
  Action ve Route Handler'da çalışmaz** — oralarda dil açık parametre geçilir.
- Desteklenmeyen dil → `notFound()`.
- `en.json` kanonik: anahtar kümesini o tanımlar. Bir testin görevi, her dilin
  anahtar kümesinin `en` ile **birebir** aynı olduğunu doğrulamaktır (eksik de
  fazla da hata).

### 2.4 Gerekçe metinleri — kritik

`explain.ts` şu anda Türkçe cümle kuruyor. Bu, `lib/recommend` saflığını da
ihlal ediyor (sunum katmanı mantığı motorda).

**Yeni sözleşme:** `explain.ts` **string üretmez**, yapı üretir:

```ts
type Explanation =
  | { kind: 'tag-match'; tags: string[]; games: { name: string; hours: number }[] }
  | { kind: 'group-match'; tags: string[]; memberCount: number }
  | { kind: 'coverage'; owned: number; total: number; missing: string[] };
```

Cümleyi sunum katmanı sözlükten kurar. Diller eklemeli/çekimli farklılık
gösterdiği için her dil kendi şablonunu taşır; Türkçe'nin ekleri İngilizce
şablonuna sığmaz. Çoğul kuralları `Intl.PluralRules` ile çözülür.

### 2.5 Yerelleştirilmeyenler — bilinçli kararlar

- **Oyun etiketleri çevrilmez.** "Souls-like", "Metroidvania", "Roguelike"
  oyun kültüründe özel ad gibi kullanılır; Türk oyuncu da "Metroidvania" der.
  Çevirmek tanınırlığı düşürür.
- **Oyun adları çevrilmez.** Store API `&l=` destekler ama oyun adları marka
  adıdır ve katalog cache'ini dil sayısıyla çarpar. MVP'de İngilizce ad.
- Tarih ve sayı biçimleri `Intl.DateTimeFormat` / `Intl.NumberFormat` ile
  yerelleştirilir.

### 2.6 Çeviri kalitesi — dürüstlük

`en` ve `tr` anadil kalitesinde yazılır. Diğer sekiz dil makine destekli
çeviridir ve anadili konuşanın gözden geçirmesi gerekir. Her sözlük dosyası
başına bir `"_meta": { "reviewed": false }` alanı konur; `en` ve `tr` için
`true`. Bu bir kalite iddiası değil, bir envanterdir.

## 3. Tasarım sistemi — Dark Mode (OLED)

ui-ux-pro-max kataloğundan `dark-mode-oled` (erişilebilirlik risk:low,
performans cost:low).

### 3.1 Token'lar

`app/globals.css` içinde `@layer base` altında CSS değişkenleri:

```
--bg:            #000000
--surface:       #121212
--surface-2:     #1C1C1E
--border:        #2C2C2E
--fg:            #FFFFFF
--fg-muted:      #A1A1A6
--accent:        #66C0F4   (Steam mavisi ailesi)
--accent-fg:     #001019
--success:       #4ADE80
--warning:       #FBBF24
--danger:        #F87171
```

**Kontrast şartı: gövde metni ≥ 7:1, ikincil metin ≥ 4.5:1.** Bu ölçülecek,
tahmin edilmeyecek.

### 3.2 Kurallar

- Tüm renk bildirimleri `@layer base` içinde. (Katmansız `*` kuralı Tailwind'in
  katmanlı utility'lerini ezer — bu hata bu projede bir kez yapıldı, R22.)
- Emoji ikon olarak kullanılmaz; SVG (lucide) kullanılır.
- Tıklanabilir her öğede `cursor-pointer`, görünür `:focus-visible` halkası.
- Geçişler 150–300 ms; `prefers-reduced-motion: reduce` tüm animasyonları kapatır.
- Kırılma noktaları 375 / 768 / 1024 / 1440 px; yatay kaydırma yok.
- Dokunma hedefi ≥ 44×44 px.

### 3.3 Tipografi

Mevcut Geist korunur (Latin + Kiril kapsar). CJK için sistem yazı tipi zinciri
(`"Noto Sans SC", "Hiragino Sans", "Yu Gothic", "Malgun Gothic", sans-serif`) —
üç ek font indirmemek için bilinçli tercih. Taban 16 px, satır yüksekliği 1.5.

## 4. Gizlilik

### 4.1 Rıza kapısı kaldırılır

Kullanıcıyı durduran onay kutusu yok. Hukuki sebep: hizmetin ifası
(GDPR Art. 6(1)(b) / KVKK m.5/2-c). Kişisel veri saklanmadığı için rıza
gerekmez — önceki spec'in Katman 0'ı zaten böyleydi.

### 4.2 Privacy notice

Tek sayfa `/[lang]/privacy`, 10 dilde. İçerik: hangi veriler alınır, ne
kadar tutulur (tutulmaz), üçüncü taraf kaynaklar (Steam, SteamSpy), haklar,
iletişim. **İngilizce metin asıl (authoritative)**; diğer diller bilgilendirme
amaçlı ve sayfada bu belirtilir. Footer'da link; kimseyi durdurmaz.

Veri sorumlusu kimlik alanları hâlâ placeholder; taslak bandı korunur.

### 4.3 Arkadaş verisi

Arkadaşlar rıza vermez. Kullanıcının kararıdır. Zararı sınırlayan üç kural
**şart**:

1. Arkadaş verisi **hiçbir koşulda diske yazılmaz** — ne DB'ye, ne çereze, ne loga.
2. Arkadaştan **yalnızca** `appid` listesi alınır; oynama süresi, persona ve
   avatar yalnızca seçim ekranında gösterilir, istek bitince atılır.
3. Sonuç ekranı arkadaşın kütüphanesini **dökmez**; yalnızca kesişimi ve
   "kimde yok" bilgisini gösterir.

Privacy notice bunu açıkça yazar.

## 5. Arkadaş grubu

### 5.1 Veri kaynakları (ek)

| Kaynak | Ne için | Not |
|---|---|---|
| `ISteamUser/GetFriendList/v1` | arkadaş SteamID64 listesi | Arkadaş listesi gizliyse boş/hata |
| `ISteamUser/GetPlayerSummaries/v2` | persona + avatar (toplu, ≤100/istek) | Yalnızca seçim ekranı |
| Store `appdetails` → `categories` | çok oyunculu tespiti | **Yeni alan** |

Yalnızca OpenID ile giriş yapmış kullanıcı arkadaş listesine erişebilir.
Demo (link yapıştırma) modunda grup özelliği **kapalıdır** — sahiplik
kanıtlanmamış bir hesabın arkadaş listesini çekmek savunulamaz.

Grup üst sınırı: **10 kişi** (kullanıcı dahil). Sebep: her üye için bir
`GetOwnedGames` çağrısı, fetch timeout bütçesi ve `min` skorun anlamlılığı.

### 5.2 Çok oyunculu metadata — şema değişikliği

Steam `appdetails` `categories` döndürür. İlgili id'ler:
`1` Multi-player, `9` Co-op, `36` Online PvP, `38` Online Co-op, `39` LAN Co-op,
`47` LAN PvP, `48` Shared/Split Screen PvP, `49` Shared/Split Screen Co-op.

- `GameMeta` yeni alan: `categories: number[]`.
- `game_meta` yeni kolon: `categories_json TEXT NOT NULL DEFAULT '[]'`.
- **Migrasyon şart:** `CREATE TABLE IF NOT EXISTS` var olan tabloya kolon
  eklemez. `PRAGMA user_version` ile sürümlenir; v0→v1 `ALTER TABLE ADD COLUMN`.
  Var olan satırlar `'[]'` alır ve `fetched_at` sıfırlanarak yeniden çekilmeye
  aday olur.
- `isMultiplayer(meta)` saf yardımcı: yukarıdaki id'lerden en az biri.
- `isCoop(meta)`: `9, 38, 39, 49`.

### 5.3 Grup zevk vektörü ve skorlama

Her üye için mevcut `buildUserVector` ayrı ayrı çalışır. Birleştirme
**skor düzeyinde** yapılır, vektör düzeyinde değil:

```
her aday c için:
  s_i = normalize edilmiş skor(üye_i, c)        // [0,1], §6.3 + C1 normalizasyonu
  groupScore(c) = λ * mean(s_i) + (1-λ) * min(s_i)
  λ = 0.6
```

Vektör ortalaması **kullanılmaz**: biri souls-like biri farming sim oynuyorsa
ortalama vektör ikisi de olmayan bir orta nokta üretir. `min` terimi
"bir kişi sevmezse grup oynamaz" gerçeğini taşır; `mean` terimi nüansı korur.

Normalizasyon şart: üye skorları aynı aralıkta olmadan `min` anlamsızdır
(bu, C1'de öğrenilen dersin aynısı).

### 5.4 İki sekme

**Sekme 1 — "Şimdi oynayabilirsiniz".** Grubun kütüphanelerindeki çok
oyunculu oyunlar.

```
coverage(c) = sahip olan üye sayısı / grup büyüklüğü
rank = coverage DESC, sonra groupScore DESC, sonra positiveRatio DESC
```

Tam kapsanan oyunlar (`coverage === 1`) üstte ayrı bir blokta; altındaki blok
"biri alırsa oynanır" başlığıyla eksik olanları gösterir ve **kimde olmadığını
adıyla** yazar. Kalite kapısı burada uygulanmaz — zaten sahip olunan oyunlar.

**Sekme 2 — "Birlikte alabilirsiniz".** Son 90 günde çıkmış, kalite kapısını
geçen, çok oyunculu, **hiçbir üyede olmayan** oyunlar; `groupScore` ile
sıralanır, MMR çeşitlendirmesi uygulanır, skoru ≤ 0 olanlar elenir (C2 kuralı).

Her iki sekmede gerekçe zorunlu (§2.4 yapısı).

### 5.5 Hata yolları

- Arkadaş listesi gizli → `FriendListPrivateError` → 409, kendi ekranı.
- Seçilen arkadaşın oyun detayları gizli → o üye gruptan **düşürülür**,
  ekranda adıyla belirtilir, kalan grupla devam edilir. İstek başarısız olmaz.
- Tüm arkadaşlar düşerse → tek kişilik akışa geri dönülür, açıklamayla.
- Demo modunda grup uçları → 403.

## 6. Test stratejisi

- Her guard için mutasyon doğrulaması (R15): guard kırılır, testin kırmızıya
  döndüğü görülür, geri alınır.
- Sözlük bütünlüğü testi: 10 dilin anahtar kümesi `en` ile birebir aynı.
- `negotiate()` saf fonksiyonu için q-değeri, bölgesel varyant ve
  desteklenmeyen dil testleri.
- Migrasyon testi: v0 şemalı bir DB açılır, kolonun eklendiği ve var olan
  satırların korunduğu doğrulanır.
- Grup skorlama: `min` teriminin gerçekten etkili olduğunu gösteren test
  (bir üyenin skoru sıfıra çekildiğinde sıranın değiştiği).
- Kapsama sıralaması: `coverage` eşitliğinde `groupScore`a düştüğü.
- Kontrast: token çiftleri için hesaplanmış oran testi.
- Erişilebilirlik: her sayfada tek `h1`, form alanlarının etiketli olduğu.

## 7. Kapsam dışı

- Hız sınırlama (R27) — altyapı kararı, kullanıcıya bırakıldı.
- Oyun adı/açıklaması yerelleştirmesi (§2.5).
- Arkadaşın arkadaşı, grup kaydetme, davet linki, bildirim.
- RTL diller (Arapça, İbranice) — dil setinde yok.
