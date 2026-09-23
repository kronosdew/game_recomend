# game_recomend

Steam profilindeki oynama sürelerinden bir zevk profili çıkarıp son 90 günde
çıkmış oyunlar arasından uyanları gerekçesiyle öneren Next.js uygulaması.
Bağlayıcı tanım: `docs/superpowers/specs/steam-oyun-onerici.md`.

## Çalıştırma

```bash
npm run dev          # geliştirme sunucusu
npm test             # vitest
npm run build        # üretim derlemesi
```

Gereken ortam değişkenleri:

| Değişken | Zorunlu | Ne için |
|---|---|---|
| `STEAM_API_KEY` | evet | Steam Web API. **Yalnızca sunucuda** kullanılır, istemciye hiçbir koşulda sızmaz. |
| `APP_ORIGIN` | evet | Steam OpenID `return_to` / `realm` adresi (ör. `http://localhost:3000`). |
| `CATALOG_PAGES` | hayır | Katalog tazeleme betiğinin tarayacağı sayfa sayısı (varsayılan 4). |

## Katalog tazeleme kadansı

Öneri motoru istek anında yeni çıkanları ÇEKMEZ (spec §6.2): aday havuzu
önceden toplanıp yerel SQLite kataloğuna (`data/catalog.db`) yazılır. Bunu
yapan betik:

```bash
npm run refresh:catalog
```

Spec §6.2 havuzun **son 90 günü** kapsamasını ister ve tek bir çalıştırma
bunu sağlayamaz. Store araması çıkış tarihine göre azalan sıralı döner, yani
her çalıştırma yalnızca en yeni N sürümü görür:

| Ayar | Taranan appid | Kabaca kapsanan pencere | Süre |
|---|---|---|---|
| `pages = 4` (varsayılan) | ~200 | son ~4 gün | ~7-8 dk |
| `CATALOG_PAGES=40` | ~2000 | son ~40 gün | ~75 dk |

(Steam'e günde ~50 oyun çıkıyor.)

- **Rutin: günde en az bir kez**, varsayılan ayarla. 90 günlük pencere
  birikerek dolar ve kendini günceller. Atlanan bir gün, o güne ait
  çıkışların pencereye hiç girmemesi demektir.
- **İlk doldurma:** katalog boşken tek seferlik `CATALOG_PAGES=40` (veya daha
  fazlası) ile çalıştırın, sonra günlük rutine dönün. Katalog boşken uygulama
  "katalog henüz hazır değil" der — kullanıcıyı suçlamaz.
- Betikteki `delayMs` (1100 ms) **düşürülmemelidir**: SteamSpy ~1 istek/sn,
  Store ~200 istek/5 dk sınırına sahiptir.

Örnek cron (her gün 04:30):

```
30 4 * * *  cd /uygulama && npm run refresh:catalog >> /var/log/katalog.log 2>&1
```

## Claude Code eklentileri

Bu repo üç Claude Code eklentisi kullanacak şekilde yapılandırıldı. Marketplace
tanımları ve eklenti aktivasyonu `.claude/settings.json` içinde durur, yani yeni
bir Claude Code oturumu bunları otomatik yükler.

| Eklenti | Kaynak | Ne işe yarar | Skill sayısı |
|---|---|---|---|
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | UI/UX tasarım kütüphanesi: 79 stil, 192 palet, 74 font eşleşmesi, 25 grafik, 22 stack rehberi | 7 |
| `superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | TDD, sistematik hata ayıklama, plan yazma/uygulama, kod inceleme iş akışları | 15 |
| `claude-mem` | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | Oturumlar arası kalıcı hafıza / bağlam sıkıştırma | 20 |

Toplam 42 skill, oturum başına ~3.9k token sabit maliyet.

### Kurulum

Yeni bir makinede veya yeni bir container'da:

```bash
./scripts/setup-plugins.sh
```

`.claude/settings.json` marketplace'leri ve eklentileri hallediyor. Script yalnızca
`claude-mem`'in eklenti manifestinin parçası olmayan ek runtime'ını kuruyor
(Bun + uv + yerel SQLite veritabanı).

### claude-mem notları

- **Yerel sağlayıcı** ile kuruldu (`--provider claude`): sıkıştırma kendi Anthropic
  hesabınız üzerinden çalışır, **bulut senkronizasyonu kapalı**. cmem.ai hesabı gerekmez.
- Veriler `~/.claude-mem` altında, sadece o makinede durur.
- Hafıza enjeksiyonu bir projedeki **ikinci** oturumdan itibaren başlar.
- Worker'ı elle başlatmak için: `npx claude-mem start` (arayüz: http://127.0.0.1:37700).
- Tüm repoyu önden taratmak isterseniz: `/learn-codebase`.

> Not: Claude Code web oturumları geçici (ephemeral) container'da çalışır. `~/.claude`
> altındaki her şey — claude-mem veritabanı dahil — oturum bitince silinir. Eklentiler
> `.claude/settings.json` sayesinde her oturumda yeniden yüklenir, ama claude-mem'in
> biriktirdiği hafıza oturumlar arasında kalıcı olmaz.
