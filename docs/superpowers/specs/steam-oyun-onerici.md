# Steam Profil Tabanlı Oyun Öneri Sistemi — Spec

**Durum:** Onaylandı (2026-09-22)
**Faz:** MVP = Faz 1

## 1. Amaç

Kullanıcının Steam kütüphanesindeki oynama sürelerinden bir zevk profili
çıkarıp, son 90 günde çıkmış oyunlar arasından ona uyanları gerekçesiyle
birlikte önermek.

## 2. Kapsam Dışı (açıkça)

- **Arkadaş listesi kullanılmaz.** Arkadaşlar bu sisteme rıza vermedi ve
  veremez. Üçüncü kişi verisi hiçbir şekilde işlenmez.
- Collaborative filtering yok (cold start + kullanıcılar arası veri teması).
- Özel nitelikli veri çıkarımı yapılmaz, gösterilmez.
- Oyun içi satın alma / envanter / ticaret verisi işlenmez.

## 3. Kimlik Doğrulama

### 3.1 Ana akış — Steam OpenID 2.0

Link yapıştırmak profilin **sahipliğini kanıtlamaz**. Herkes herkesin public
profil linkini yapıştırabilir. Bu durumda alınan açık rıza, profil sahibi
başkasıysa geçersizdir. OpenID girişi veri sahibi ile rıza vereni eşitler.

- Yönlendirme: `https://steamcommunity.com/openid/login`
  - `openid.ns=http://specs.openid.net/auth/2.0`
  - `openid.mode=checkid_setup`
  - `openid.return_to=<callback URL>`
  - `openid.realm=<origin>`
  - `openid.identity=http://specs.openid.net/auth/2.0/identifier_select`
  - `openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`
- **Callback parametrelerine asla doğrudan güvenilmez.** Gelen tüm `openid.*`
  parametreleri `openid.mode=check_authentication` ile Steam'e POST edilip
  yanıtta `is_valid:true` görülmeden oturum açılmaz.
- SteamID64, doğrulanmış `openid.claimed_id` içinden
  `^https://steamcommunity\.com/openid/id/(7656119[0-9]{10})$` ile çıkarılır.

### 3.2 İkincil akış — link yapıştırma (demo)

Sahiplik kanıtlanmadığı için bu mod **tamamen stateless**: hiçbir kişisel veri
kaydedilmez, oturum açılmaz, sonuç ekranda gösterilip atılır. Saklama gerektiren
hiçbir özellik (geçmiş, "bir daha gösterme", bildirim) bu modda sunulmaz.

Desteklenen biçimler:
- `https://steamcommunity.com/profiles/<steamid64>`
- `https://steamcommunity.com/id/<vanity>` → `ISteamUser/ResolveVanityURL/v1`

## 4. KVKK Uyumu

### 4.1 İki ayrı belge

- **Aydınlatma metni** (m.10): veri sorumlusu kimliği, işlenen veri kategorileri,
  amaç, hukuki sebep, saklama süresi, aktarım, m.11 hakları. Rızadan bağımsız,
  her hâlükârda gösterilir.
- **Açık rıza metni** (m.3/1-a): belirli, bilgilendirmeye dayalı, özgür irade.
  Aydınlatma metninden ve hizmet şartlarından **ayrı**. Ön işaretli kutu yok.
  Geri alınabilir.

### 4.2 Katmanlı rıza

Her katman **ayrı** onay kutusu. Paket halinde sunulamaz ("belirli olma" şartı).

| Katman | İşlem | Hukuki sebep | Faz |
|---|---|---|---|
| 0 | Profili çek, skorla, göster, **at**. Kayıt yok. | Sözleşmenin ifası (m.5/2-c) | 1 |
| 1 | Profil + öneri geçmişi saklama | Açık rıza | 2 |
| 2 | Yeni çıkanlar için e-posta bildirimi | Açık rıza | 3 |
| 3 | Anonimleştirilmiş analitik | Açık rıza | 3 |

**Katman 0 varsayılandır.** MVP yalnızca Katman 0 ile çalışır; kişisel veri
veritabanına hiç yazılmaz.

### 4.3 Rıza metni versiyonlama

Rıza metni değiştiğinde önceki rıza yeni versiyonu kapsamaz. Her rıza kaydı
`text_version` taşır; aktif versiyondan eski rıza geçersiz sayılır ve tekrar
sorulur.

### 4.4 Katalog cache kişisel veri değildir

`game_meta` tablosu (appid, isim, etiket, çıkış tarihi, inceleme sayısı) kamuya
açık oyun kataloğudur, kişisel veri içermez. Katman 0'da bile mevcuttur.
"Stateless" yalnızca **kişisel** veri için geçerlidir.

### 4.5 m.11 hakları

Katman 1+ kullanıcıları için tek bir "Verilerim" sayfası: JSON dışa aktarma +
kalıcı silme. Saklama süresi: 6 ay hareketsizlik → otomatik silme.

## 5. Veri Kaynakları

| Kaynak | Ne için | Not |
|---|---|---|
| `IPlayerService/GetOwnedGames/v1` | appid, isim, playtime_forever, playtime_2weeks | `include_appinfo=1`, `include_played_free_games=1` |
| `ISteamUser/GetPlayerSummaries/v2` | persona, avatar, `communityvisibilitystate` | |
| `ISteamUser/ResolveVanityURL/v1` | vanity → SteamID64 | `success:42` = bulunamadı |
| Store `appdetails` | tür, kategori, çıkış tarihi, fiyat | Resmî değil. Gözlemlenen limit ~200 istek / 5 dk |
| Store `search/results?json=1` | yeni çıkan aday havuzu | `sort_by=Released_DESC`. Resmî değil |
| SteamSpy `appdetails` | **kullanıcı etiketleri**, positive/negative | ~1 istek/sn |

**Steam API anahtarı yalnızca sunucu tarafında.** Frontend'e hiçbir koşulda sızmaz.

### 5.1 Gizli profil — ana kırılma noktası

Oyun detayları gizliyse `GetOwnedGames` **hata vermez**, boş obje döner:
`{"response":{}}` (`game_count` anahtarı yoktur). Bu bir edge case değil, ana
akışın parçasıdır. Kullanıcıya Steam > Profil > Gizlilik Ayarları > Oyun
detayları → "Herkese Açık" yolu ekran görüntülü anlatılır.

### 5.2 Neden SteamSpy

Steam türleri çok kaba ("Action, Indie, RPG"). Zevk eşleştirmesini yapan şey
kullanıcı etiketleri ("Souls-like", "Metroidvania", "Pixel Graphics"). Bunlar
yalnızca SteamSpy'da var.

## 6. Öneri Motoru

Saf fonksiyonlar, I/O yok. Bağımsız test edilebilir.

### 6.1 Kullanıcı zevk vektörü

```
her sahip olunan oyun g için:
  playtime_forever < 60 dk  → atla      (indirimde alınmış, açılmamış)
  w(g) = log1p(saat)                    (log şart: 2000 saatlik CS:GO
                                         her şeyi ezmesin)
  playtime_2weeks > 0       → w(g) *= 1.5   (güncellik sinyali)
  her etiket t için:
    vec[t] += w(g) * etiketAğırlığı(g, t)
L2 normalize
```

`etiketAğırlığı(g,t)` = SteamSpy oy sayısı / o oyundaki **maksimum** oy sayısı.
Ham oy kullanılırsa popüler oyunlar sırf çok oy aldığı için baskın çıkar.

### 6.2 Aday havuzu — önceden hesaplanır

İstek anında yeni çıkanlar çekilmez; rate limit'e takılır ve yavaştır. Cron ile
toplanıp cache'lenir. İstek anında yalnızca kullanıcının kütüphanesi çekilir ve
hazır havuza karşı skorlanır.

**Kalite kapısı** (Steam'e günde ~50 oyun çıkıyor, büyük kısmı çöp):
- Çıkış tarihi son 90 gün (30 değil: yeni oyunun incelemesi az olur,
  tavuk-yumurta problemini yumuşatır)
- İnceleme sayısı ≥ 50
- Pozitif oran ≥ %70
- Kullanıcının sahip olduğu oyunlar çıkarılır

### 6.3 Skorlama

```
base    = cosine(kullanıcıVektörü, adayVektörü)     (ikisi de normalize → dot)
recency = 1 + 0.2 * (1 - günGeçmiş / 90)
final   = base * recency / log1p(sahipSayısı)        ← popülerlik sönümleme,
                                                       yoksa liste AAA çöplüğü
```

### 6.4 Çeşitlilik — MMR

İlk 10'un 10'u da soulslike olmasın diye yeniden sıralama:

```
mmr(i) = λ * skor(i) - (1-λ) * max(cosine(i, seçilenler))
λ = 0.7, k = 20
```

### 6.5 Gerekçe — zorunlu

Her öneri "neden" taşır: *"Hollow Knight (120s) ve Dead Cells (80s) oynadınız →
Metroidvania + zorlu platform ağırlığınız yüksek."*

Hem UX hem KVKK şeffaflık yükümlülüğü. Öneriye en çok katkı veren 3 etiket ve o
etiketlere en çok katkı veren 2 oyun gösterilir.

### 6.6 Negatif sinyal (zayıf)

1 yıldan uzun sahip olunup 30 dk'dan az oynanmış oyunların etiketleri küçük bir
negatif ağırlık alır (katsayı 0.3). Zayıf ama ücretsiz sinyal.

## 7. Teknoloji

- Next.js (App Router) — route handler'lar API anahtarını sunucuda tutar,
  OpenID callback doğal oturur
- Tailwind + shadcn/ui
- Vitest (birim testleri)
- SQLite (katalog cache; Faz 2'de kişisel veri için Postgres)

## 8. Faz Planı

- **Faz 1 (MVP):** OpenID giriş + link demo + stateless öneri + aydınlatma/rıza
  metinleri. Kişisel veri DB'ye yazılmaz.
- **Faz 2:** Katman 1 opt-in saklama, öneri geçmişi, "bir daha gösterme",
  Verilerim sayfası (export + sil).
- **Faz 3:** Katman 2-3, e-posta bildirimi, analitik.

## 9. Diğer

- **VERBİS:** eşiklerin altındaki veri sorumluları muaf; hobi ölçeğinde büyük
  ihtimalle kapsam dışı. Tam eşikler yayına çıkmadan teyit edilmeli.
- Oyun tercihi KVKK m.6 özel nitelikli veri listesinde **değil**. Ancak dolaylı
  olarak inanç/cinsel yönelim ima eden çıkarımlar üretilmez ve gösterilmez.
