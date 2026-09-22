# game_recomend

Oyun öneri projesi. (Henüz uygulama kodu yok — şu an sadece geliştirme ortamı kurulu.)

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
