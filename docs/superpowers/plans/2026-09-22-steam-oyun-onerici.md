# Steam Oyun Önerici — Faz 1 (MVP) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Steam OpenID ile giriş yapan kullanıcının kütüphanesindeki oynama sürelerinden zevk profili çıkarıp, son 90 günde çıkmış oyunlardan gerekçeli öneri listesi üretmek — hiçbir kişisel veriyi kaydetmeden.

**Architecture:** Next.js App Router. Steam API anahtarı yalnızca route handler'larda. Öneri motoru saf fonksiyonlar (I/O yok, Vitest ile bağımsız test edilir). Oyun katalogu SQLite'ta cache'lenir ve cron ile tazelenir; istek anında yalnızca kullanıcının kütüphanesi çekilip hazır havuza karşı skorlanır. Kişisel veri veritabanına yazılmaz (Katman 0).

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Vitest, better-sqlite3

**Spec:** `docs/superpowers/specs/steam-oyun-onerici.md`

## Global Constraints

- `STEAM_API_KEY` yalnızca sunucu tarafında okunur. `NEXT_PUBLIC_` önekiyle **hiçbir** Steam sırrı tanımlanmaz.
- Faz 1'de kişisel veri (SteamID, persona, oynama süresi) veritabanına **yazılmaz**. Sadece `game_meta` katalog cache'i yazılır.
- Arkadaş listesi endpoint'i (`GetFriendList`) hiçbir yerde çağrılmaz.
- Tüm kullanıcıya görünen metinler Türkçe.
- Öneri motoru dosyaları (`lib/recommend/*`) `fetch`, `fs` veya DB import etmez — saf fonksiyonlar.
- Minimum oynama eşiği 60 dk, kalite kapısı inceleme ≥ 50 ve pozitif ≥ 0.70, çıkış penceresi 90 gün. Bu sabitler `lib/recommend/constants.ts` içinde tek yerde durur.
- Rıza metinlerinin aktif versiyonu `lib/consent/versions.ts` içinde sabit; metin değişirse versiyon artar.

## Review Focus

1. **Gizli profil boş yanıt döner, hata değil.** `GetOwnedGames` oyun detayları gizliyken `{"response":{}}` verir. `game_count` yokluğu gizlilik demektir; `game_count: 0` ise kütüphane gerçekten boştur. İkisi farklı mesaj almalı — karıştırılırsa boş kütüphaneli kullanıcıya yanlış yönerge gösterilir. (Task 3)
2. **Boş/çok küçük vektör sıfıra bölme üretir.** 60 dk üstü hiç oyunu olmayan kullanıcıda L2 norm 0 olur. Normalize guard'ı yoksa `NaN` skorlar listeyi sessizce bozar. (Task 6)
3. **Vanity bulunamadı ile geçersiz URL farklı hatalar.** `ResolveVanityURL` bulunamayınca HTTP 200 + `success:42` döner. Geçersiz URL formatı ise hiç istek atılmadan reddedilmeli. Aynı mesaj gösterilirse kullanıcı neyi düzelteceğini bilemez. (Task 4)
4. **Metadata kaynağı kısmen çökebilir.** SteamSpy rate limit yerse ya da 200 dışı dönerse etiketsiz oyun oluşur. Etiketsiz aday skorlanamaz — havuzdan düşürülmeli, `NaN` skorla listeye girmemeli. (Task 5, Task 7)
5. **Eski versiyonlu rıza yeni metni kapsamaz.** Rıza metni versiyonu arttığında önceki onay geçersizdir ve tekrar sorulmalıdır. Versiyon karşılaştırması yoksa kullanıcı hiç görmediği bir metne onay vermiş sayılır. (Task 11)

---

## Dosya Yapısı

```
lib/steam/types.ts          — paylaşılan tipler ve hata sınıfları
lib/steam/openid.ts         — OpenID 2.0 URL kurma + doğrulama
lib/steam/profile-url.ts    — profil URL parse + vanity çözümleme
lib/steam/client.ts         — GetOwnedGames / GetPlayerSummaries
lib/steam/store.ts          — Store appdetails + yeni çıkanlar araması
lib/steamspy/client.ts      — SteamSpy etiketleri
lib/catalog/db.ts           — SQLite şeması ve erişim
lib/catalog/refresh.ts      — aday havuzu tazeleme işi
lib/recommend/constants.ts  — eşikler tek yerde
lib/recommend/vector.ts     — TagVector yardımcıları (normalize, cosine)
lib/recommend/user-vector.ts— oynama süresi → zevk vektörü
lib/recommend/scoring.ts    — kalite kapısı + skorlama
lib/recommend/mmr.ts        — çeşitlilik yeniden sıralama
lib/recommend/explain.ts    — gerekçe üretimi
lib/consent/versions.ts     — aktif metin versiyonları
app/api/auth/steam/route.ts          — OpenID başlat
app/api/auth/steam/callback/route.ts — OpenID doğrula
app/api/recommend/route.ts           — ana öneri endpoint
app/page.tsx                — giriş + link demo
app/oneriler/page.tsx       — sonuç listesi
app/aydinlatma-metni/page.tsx
app/acik-riza/page.tsx
components/GameCard.tsx     — öneri kartı + gerekçe
components/PrivacyHelp.tsx  — gizli profil yönergesi
components/ConsentGate.tsx  — katmanlı rıza kapısı
```

---

### Task 1: Proje iskeleti ve test altyapısı

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `lib/recommend/constants.ts`
- Test: `lib/recommend/constants.test.ts`

**Interfaces:**
- Consumes: yok
- Produces: `MIN_PLAYTIME_MINUTES`, `RECENT_BOOST`, `NEGATIVE_WEIGHT`, `ABANDONED_MINUTES`, `MIN_REVIEWS`, `MIN_POSITIVE_RATIO`, `RELEASE_WINDOW_DAYS`, `MMR_LAMBDA`, `MMR_K`

- [ ] **Step 1: Next.js projesini kur**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint \
  --src-dir=false --import-alias="@/*"
npm install better-sqlite3
npm install -D vitest @vitest/coverage-v8 @types/better-sqlite3
```

- [ ] **Step 2: Vitest yapılandır**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

`package.json` içine script ekle: `"test": "vitest run"`, `"test:watch": "vitest"`

- [ ] **Step 3: Sabitler için testi yaz**

`lib/recommend/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as C from './constants';

describe('constants', () => {
  it('spec eşiklerini taşır', () => {
    expect(C.MIN_PLAYTIME_MINUTES).toBe(60);
    expect(C.MIN_REVIEWS).toBe(50);
    expect(C.MIN_POSITIVE_RATIO).toBeCloseTo(0.70);
    expect(C.RELEASE_WINDOW_DAYS).toBe(90);
    expect(C.MMR_LAMBDA).toBeCloseTo(0.7);
  });
});
```

- [ ] **Step 4: Testi çalıştır, başarısız olduğunu gör**

Run: `npm test`
Expected: FAIL — `Cannot find module './constants'`

- [ ] **Step 5: Sabitleri yaz**

`lib/recommend/constants.ts`:
```ts
export const MIN_PLAYTIME_MINUTES = 60;
export const RECENT_BOOST = 1.5;
export const NEGATIVE_WEIGHT = 0.3;
export const ABANDONED_MINUTES = 30;
export const ABANDONED_AFTER_SECONDS = 365 * 24 * 3600;

export const MIN_REVIEWS = 50;
export const MIN_POSITIVE_RATIO = 0.70;
export const RELEASE_WINDOW_DAYS = 90;

export const MMR_LAMBDA = 0.7;
export const MMR_K = 20;
```

- [ ] **Step 6: Testi çalıştır, geçtiğini gör**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: .env.example ve .gitignore**

`.env.example`:
```
# Steam Web API anahtarı — https://steamcommunity.com/dev/apikey
# SADECE sunucu tarafı. NEXT_PUBLIC_ öneki KULLANMA.
STEAM_API_KEY=
# OpenID callback için uygulamanın kök adresi
APP_ORIGIN=http://localhost:3000
```

`.gitignore` içine ekle: `.env`, `.env.local`, `data/*.db`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: proje iskeleti, vitest ve öneri sabitleri"
```

---

### Task 2: Steam OpenID 2.0 doğrulama

Güvenlik kritik: callback parametrelerine doğrudan güvenmek kimlik sahteciliğine açar.

**Files:**
- Create: `lib/steam/openid.ts`, `lib/steam/types.ts`
- Test: `lib/steam/openid.test.ts`

**Interfaces:**
- Consumes: yok
- Produces: `buildLoginUrl(returnTo: string, realm: string): string`, `verifyCallback(params: URLSearchParams, fetchImpl?: typeof fetch): Promise<string>` (SteamID64 döner), `OpenIdVerificationError`

- [ ] **Step 1: Hata sınıflarını yaz**

`lib/steam/types.ts`:
```ts
export class OpenIdVerificationError extends Error {}
export class PrivateProfileError extends Error {}
export class VanityNotFoundError extends Error {}
export class InvalidProfileUrlError extends Error {}

export interface OwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;      // dakika
  playtime_2weeks?: number;
  rtime_last_played?: number;    // unix saniye
}

export interface GameMeta {
  appid: number;
  name: string;
  tags: Map<string, number>;     // 0..1 normalize
  genres: string[];
  releaseDate: string;           // ISO yyyy-mm-dd
  reviewCount: number;
  positiveRatio: number;
  owners: number;
}

export type TagVector = Map<string, number>;
```

- [ ] **Step 2: Başarısız testleri yaz**

`lib/steam/openid.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { buildLoginUrl, verifyCallback } from './openid';
import { OpenIdVerificationError } from './types';

const CLAIMED = 'https://steamcommunity.com/openid/id/76561198012345678';

function callbackParams(claimed = CLAIMED) {
  return new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.claimed_id': claimed,
    'openid.identity': claimed,
    'openid.sig': 'abc',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity',
  });
}

const okFetch = () =>
  vi.fn().mockResolvedValue({ text: async () => 'ns:...\nis_valid:true\n' });

describe('buildLoginUrl', () => {
  it('identifier_select ile Steam login URL kurar', () => {
    const url = new URL(buildLoginUrl('http://x/cb', 'http://x'));
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login');
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.return_to')).toBe('http://x/cb');
    expect(url.searchParams.get('openid.identity'))
      .toBe('http://specs.openid.net/auth/2.0/identifier_select');
  });
});

describe('verifyCallback', () => {
  it('geçerli yanıtta SteamID64 döner', async () => {
    const f = okFetch();
    await expect(verifyCallback(callbackParams(), f as never))
      .resolves.toBe('76561198012345678');
  });

  it('Steam mode=check_authentication ile POST edilir', async () => {
    const f = okFetch();
    await verifyCallback(callbackParams(), f as never);
    const body = f.mock.calls[0][1].body as URLSearchParams;
    expect(f.mock.calls[0][1].method).toBe('POST');
    expect(body.get('openid.mode')).toBe('check_authentication');
  });

  it('is_valid:false ise reddeder', async () => {
    const f = vi.fn().mockResolvedValue({ text: async () => 'is_valid:false\n' });
    await expect(verifyCallback(callbackParams(), f as never))
      .rejects.toBeInstanceOf(OpenIdVerificationError);
  });

  it('is_valid:true olsa bile yabancı claimed_id reddedilir', async () => {
    const f = okFetch();
    await expect(
      verifyCallback(callbackParams('https://evil.example/openid/id/76561198012345678'), f as never)
    ).rejects.toBeInstanceOf(OpenIdVerificationError);
  });

  it('SteamID64 biçimi tutmuyorsa reddedilir', async () => {
    const f = okFetch();
    await expect(
      verifyCallback(callbackParams('https://steamcommunity.com/openid/id/123'), f as never)
    ).rejects.toBeInstanceOf(OpenIdVerificationError);
  });
});
```

- [ ] **Step 3: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/steam/openid.test.ts`
Expected: FAIL — `Cannot find module './openid'`

- [ ] **Step 4: Uygulamayı yaz**

`lib/steam/openid.ts`:
```ts
import { OpenIdVerificationError } from './types';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID_RE =
  /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

export function buildLoginUrl(returnTo: string, realm: string): string {
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID}?${p.toString()}`;
}

export async function verifyCallback(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams(params);
  body.set('openid.mode', 'check_authentication');

  const res = await fetchImpl(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();

  if (!/^is_valid:true\s*$/m.test(text)) {
    throw new OpenIdVerificationError('Steam doğrulaması başarısız.');
  }

  const match = CLAIMED_ID_RE.exec(params.get('openid.claimed_id') ?? '');
  if (!match) {
    throw new OpenIdVerificationError('Geçersiz claimed_id.');
  }
  return match[1];
}
```

- [ ] **Step 5: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/steam/openid.test.ts`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
git add lib/steam/openid.ts lib/steam/types.ts lib/steam/openid.test.ts
git commit -m "feat: Steam OpenID 2.0 doğrulama"
```

---

### Task 3: Steam Web API istemcisi ve gizli profil tespiti

Review Focus #1 buraya ait.

**Files:**
- Create: `lib/steam/client.ts`
- Test: `lib/steam/client.test.ts`

**Interfaces:**
- Consumes: `OwnedGame`, `PrivateProfileError` (`lib/steam/types.ts`)
- Produces: `getOwnedGames(steamId: string, apiKey: string, fetchImpl?): Promise<OwnedGame[]>`, `getPlayerSummary(steamId, apiKey, fetchImpl?): Promise<{personaName: string; avatar: string; visibility: number}>`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/steam/client.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { getOwnedGames } from './client';
import { PrivateProfileError } from './types';

const jsonFetch = (payload: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => payload });

describe('getOwnedGames', () => {
  it('oyun listesini döner', async () => {
    const f = jsonFetch({
      response: { game_count: 1, games: [
        { appid: 4000, name: 'Garry’s Mod', playtime_forever: 300 },
      ] },
    });
    const games = await getOwnedGames('765', 'k', f as never);
    expect(games).toHaveLength(1);
    expect(games[0].appid).toBe(4000);
  });

  it('gizli profilde PrivateProfileError atar', async () => {
    const f = jsonFetch({ response: {} });
    await expect(getOwnedGames('765', 'k', f as never))
      .rejects.toBeInstanceOf(PrivateProfileError);
  });

  it('kütüphane boş ama profil açıksa hata DEĞİL, boş dizi döner', async () => {
    const f = jsonFetch({ response: { game_count: 0, games: [] } });
    await expect(getOwnedGames('765', 'k', f as never)).resolves.toEqual([]);
  });

  it('game_count var ama games yoksa boş dizi döner', async () => {
    const f = jsonFetch({ response: { game_count: 0 } });
    await expect(getOwnedGames('765', 'k', f as never)).resolves.toEqual([]);
  });

  it('API anahtarını sorgu dizesine koyar ve ücretsiz oyunları dahil eder', async () => {
    const f = jsonFetch({ response: { game_count: 0, games: [] } });
    await getOwnedGames('765', 'secret', f as never);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('key=secret');
    expect(url).toContain('include_appinfo=1');
    expect(url).toContain('include_played_free_games=1');
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/steam/client.test.ts`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Uygulamayı yaz**

`lib/steam/client.ts`:
```ts
import { OwnedGame, PrivateProfileError } from './types';

const API = 'https://api.steampowered.com';

export async function getOwnedGames(
  steamId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OwnedGame[]> {
  const url =
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId)}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`;

  const res = await fetchImpl(url);
  const json = (await res.json()) as {
    response?: { game_count?: number; games?: OwnedGame[] };
  };

  // Oyun detayları gizliyse Steam hata vermez, boş response döner.
  // game_count: 0 ise kütüphane gerçekten boştur — bu gizlilik değildir.
  if (!json.response || json.response.game_count === undefined) {
    throw new PrivateProfileError(
      'Steam profilinin oyun detayları gizli görünüyor.',
    );
  }
  return json.response.games ?? [];
}

export async function getPlayerSummary(
  steamId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ personaName: string; avatar: string; visibility: number }> {
  const url =
    `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}` +
    `&steamids=${encodeURIComponent(steamId)}`;
  const res = await fetchImpl(url);
  const json = (await res.json()) as {
    response?: { players?: Array<{
      personaname: string; avatarfull: string; communityvisibilitystate: number;
    }> };
  };
  const p = json.response?.players?.[0];
  if (!p) throw new PrivateProfileError('Profil bulunamadı.');
  return {
    personaName: p.personaname,
    avatar: p.avatarfull,
    visibility: p.communityvisibilitystate,
  };
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/steam/client.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add lib/steam/client.ts lib/steam/client.test.ts
git commit -m "feat: Steam Web API istemcisi, gizli profil ile boş kütüphaneyi ayırır"
```

---

### Task 4: Profil URL parse ve vanity çözümleme

Review Focus #3 buraya ait.

**Files:**
- Create: `lib/steam/profile-url.ts`
- Test: `lib/steam/profile-url.test.ts`

**Interfaces:**
- Consumes: `VanityNotFoundError`, `InvalidProfileUrlError`
- Produces: `parseProfileUrl(input: string): {kind:'id64'; id:string} | {kind:'vanity'; vanity:string}`, `resolveToSteamId64(input, apiKey, fetchImpl?): Promise<string>`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/steam/profile-url.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { parseProfileUrl, resolveToSteamId64 } from './profile-url';
import { InvalidProfileUrlError, VanityNotFoundError } from './types';

describe('parseProfileUrl', () => {
  it('profiles/<id64> biçimini tanır', () => {
    expect(parseProfileUrl('https://steamcommunity.com/profiles/76561198012345678'))
      .toEqual({ kind: 'id64', id: '76561198012345678' });
  });

  it('id/<vanity> biçimini tanır', () => {
    expect(parseProfileUrl('https://steamcommunity.com/id/gaben/'))
      .toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('çıplak SteamID64 kabul eder', () => {
    expect(parseProfileUrl('76561198012345678'))
      .toEqual({ kind: 'id64', id: '76561198012345678' });
  });

  it('steamcommunity dışı alan adını reddeder', () => {
    expect(() => parseProfileUrl('https://evil.example/id/gaben'))
      .toThrow(InvalidProfileUrlError);
  });

  it('anlamsız girdiyi reddeder', () => {
    expect(() => parseProfileUrl('merhaba')).toThrow(InvalidProfileUrlError);
  });
});

describe('resolveToSteamId64', () => {
  it('id64 girdisinde ağ çağrısı yapmaz', async () => {
    const f = vi.fn();
    await expect(resolveToSteamId64('76561198012345678', 'k', f as never))
      .resolves.toBe('76561198012345678');
    expect(f).not.toHaveBeenCalled();
  });

  it('vanity çözümler', async () => {
    const f = vi.fn().mockResolvedValue({
      json: async () => ({ response: { success: 1, steamid: '76561198012345678' } }),
    });
    await expect(resolveToSteamId64('https://steamcommunity.com/id/gaben', 'k', f as never))
      .resolves.toBe('76561198012345678');
  });

  it('success:42 bulunamadı hatasına çevrilir', async () => {
    const f = vi.fn().mockResolvedValue({
      json: async () => ({ response: { success: 42, message: 'No match' } }),
    });
    await expect(resolveToSteamId64('https://steamcommunity.com/id/yok', 'k', f as never))
      .rejects.toBeInstanceOf(VanityNotFoundError);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/steam/profile-url.test.ts`
Expected: FAIL — `Cannot find module './profile-url'`

- [ ] **Step 3: Uygulamayı yaz**

`lib/steam/profile-url.ts`:
```ts
import { InvalidProfileUrlError, VanityNotFoundError } from './types';

const ID64_RE = /^7656119\d{10}$/;
const VANITY_RE = /^[A-Za-z0-9_-]{2,64}$/;

export type ParsedProfile =
  | { kind: 'id64'; id: string }
  | { kind: 'vanity'; vanity: string };

export function parseProfileUrl(input: string): ParsedProfile {
  const raw = input.trim();
  if (ID64_RE.test(raw)) return { kind: 'id64', id: raw };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidProfileUrlError('Geçerli bir Steam profil adresi girin.');
  }
  if (url.hostname !== 'steamcommunity.com') {
    throw new InvalidProfileUrlError('Adres steamcommunity.com olmalı.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'profiles' && ID64_RE.test(parts[1])) {
    return { kind: 'id64', id: parts[1] };
  }
  if (parts.length >= 2 && parts[0] === 'id' && VANITY_RE.test(parts[1])) {
    return { kind: 'vanity', vanity: parts[1] };
  }
  throw new InvalidProfileUrlError('Profil adresi tanınamadı.');
}

export async function resolveToSteamId64(
  input: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const parsed = parseProfileUrl(input);
  if (parsed.kind === 'id64') return parsed.id;

  const url =
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/` +
    `?key=${encodeURIComponent(apiKey)}&vanityurl=${encodeURIComponent(parsed.vanity)}`;
  const res = await fetchImpl(url);
  const json = (await res.json()) as {
    response?: { success?: number; steamid?: string };
  };
  if (json.response?.success !== 1 || !json.response.steamid) {
    throw new VanityNotFoundError('Bu özel adrese sahip bir profil bulunamadı.');
  }
  return json.response.steamid;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/steam/profile-url.test.ts`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add lib/steam/profile-url.ts lib/steam/profile-url.test.ts
git commit -m "feat: profil URL parse ve vanity çözümleme"
```

---

### Task 5: Metadata istemcileri — Store ve SteamSpy

Review Focus #4 buraya ait: etiketi olmayan oyun havuza girmemeli.

**Files:**
- Create: `lib/steam/store.ts`, `lib/steamspy/client.ts`
- Test: `lib/steamspy/client.test.ts`, `lib/steam/store.test.ts`

**Interfaces:**
- Consumes: `GameMeta`
- Produces: `fetchSteamSpyTags(appid, fetchImpl?): Promise<{tags: Map<string,number>; positive: number; negative: number; owners: number}>`, `normalizeTags(raw: Record<string, number>): Map<string, number>`, `fetchStoreDetails(appid, fetchImpl?): Promise<{name: string; genres: string[]; releaseDate: string; type: string} | null>`, `fetchNewReleaseAppIds(fetchImpl?): Promise<number[]>`

- [ ] **Step 1: SteamSpy testlerini yaz**

`lib/steamspy/client.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { normalizeTags, fetchSteamSpyTags } from './client';

describe('normalizeTags', () => {
  it('en yüksek oya böler — popüler oyun sırf çok oy aldığı için baskın çıkmasın', () => {
    const out = normalizeTags({ 'Souls-like': 1000, 'Metroidvania': 500, 'Indie': 250 });
    expect(out.get('Souls-like')).toBeCloseTo(1.0);
    expect(out.get('Metroidvania')).toBeCloseTo(0.5);
    expect(out.get('Indie')).toBeCloseTo(0.25);
  });

  it('boş etiket kümesinde boş Map döner', () => {
    expect(normalizeTags({}).size).toBe(0);
  });

  it('tüm oylar sıfırsa sıfıra bölmez', () => {
    const out = normalizeTags({ 'A': 0, 'B': 0 });
    expect([...out.values()].every(Number.isFinite)).toBe(true);
  });
});

describe('fetchSteamSpyTags', () => {
  it('etiketleri ve inceleme sayılarını döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: { 'Souls-like': 800, 'Difficult': 400 },
        positive: 900, negative: 100, owners: '500,000 .. 1,000,000',
      }),
    });
    const out = await fetchSteamSpyTags(1, f as never);
    expect(out.tags.get('Souls-like')).toBeCloseTo(1.0);
    expect(out.positive).toBe(900);
    expect(out.owners).toBeGreaterThan(0);
  });

  it('HTTP hatasında null-benzeri boş sonuç yerine fırlatır', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchSteamSpyTags(1, f as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/steamspy/client.test.ts`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: SteamSpy istemcisini yaz**

`lib/steamspy/client.ts`:
```ts
const BASE = 'https://steamspy.com/api.php';

export function normalizeTags(raw: Record<string, number>): Map<string, number> {
  const entries = Object.entries(raw ?? {});
  if (entries.length === 0) return new Map();
  const max = Math.max(...entries.map(([, v]) => v));
  if (!Number.isFinite(max) || max <= 0) return new Map();
  return new Map(entries.map(([k, v]) => [k, v / max]));
}

// "500,000 .. 1,000,000" → 750000 (aralık ortası)
function parseOwners(s: string | number | undefined): number {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const nums = s.replace(/,/g, '').match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  const vals = nums.map(Number);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function fetchSteamSpyTags(
  appid: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ tags: Map<string, number>; positive: number; negative: number; owners: number }> {
  const res = await fetchImpl(`${BASE}?request=appdetails&appid=${appid}`);
  if (!res.ok) throw new Error(`SteamSpy ${appid}: HTTP ${res.status}`);
  const j = (await res.json()) as {
    tags?: Record<string, number> | never[];
    positive?: number; negative?: number; owners?: string;
  };
  const rawTags = Array.isArray(j.tags) ? {} : (j.tags ?? {});
  return {
    tags: normalizeTags(rawTags),
    positive: j.positive ?? 0,
    negative: j.negative ?? 0,
    owners: parseOwners(j.owners),
  };
}
```

Not: SteamSpy etiketi olmayan oyunlarda `tags` alanını boş **dizi** olarak döner, obje değil. `Array.isArray` kontrolü bunun içindir.

- [ ] **Step 4: SteamSpy testlerini çalıştır**

Run: `npx vitest run lib/steamspy/client.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Store testlerini yaz**

`lib/steam/store.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchStoreDetails, parseReleaseDate } from './store';

describe('parseReleaseDate', () => {
  it('Steam tarih biçimini ISO’ya çevirir', () => {
    expect(parseReleaseDate('12 Sep, 2026')).toBe('2026-09-12');
  });
  it('çözemediğinde null döner', () => {
    expect(parseReleaseDate('Coming soon')).toBeNull();
  });
});

describe('fetchStoreDetails', () => {
  it('oyun verisini döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '42': { success: true, data: {
        name: 'Test Game', type: 'game',
        genres: [{ description: 'Action' }, { description: 'Indie' }],
        release_date: { coming_soon: false, date: '12 Sep, 2026' },
      } } }),
    });
    const out = await fetchStoreDetails(42, f as never);
    expect(out?.name).toBe('Test Game');
    expect(out?.genres).toEqual(['Action', 'Indie']);
    expect(out?.releaseDate).toBe('2026-09-12');
  });

  it('success:false ise null döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ '42': { success: false } }),
    });
    await expect(fetchStoreDetails(42, f as never)).resolves.toBeNull();
  });

  it('oyun olmayan (dlc) girdide null döner', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '42': { success: true, data: {
        name: 'Some DLC', type: 'dlc', genres: [],
        release_date: { coming_soon: false, date: '12 Sep, 2026' },
      } } }),
    });
    await expect(fetchStoreDetails(42, f as never)).resolves.toBeNull();
  });
});
```

- [ ] **Step 6: Store testlerini çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/steam/store.test.ts`
Expected: FAIL — `Cannot find module './store'`

- [ ] **Step 7: Store istemcisini yaz**

`lib/steam/store.ts`:
```ts
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseReleaseDate(input: string | undefined): string | null {
  if (!input) return null;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
}

export async function fetchStoreDetails(
  appid: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ name: string; genres: string[]; releaseDate: string; type: string } | null> {
  const res = await fetchImpl(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=turkish`,
  );
  if (!res.ok) throw new Error(`Store ${appid}: HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, {
    success: boolean;
    data?: {
      name: string; type: string;
      genres?: Array<{ description: string }>;
      release_date?: { coming_soon: boolean; date: string };
    };
  }>;
  const entry = j[String(appid)];
  if (!entry?.success || !entry.data) return null;
  if (entry.data.type !== 'game') return null;
  if (entry.data.release_date?.coming_soon) return null;

  const releaseDate = parseReleaseDate(entry.data.release_date?.date);
  if (!releaseDate) return null;

  return {
    name: entry.data.name,
    type: entry.data.type,
    genres: (entry.data.genres ?? []).map((g) => g.description),
    releaseDate,
  };
}

// Resmî olmayan uç nokta. Çıkış tarihine göre azalan sıralı oyun listesi.
export async function fetchNewReleaseAppIds(
  fetchImpl: typeof fetch = fetch,
  pages = 4,
): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 0; page < pages; page++) {
    const res = await fetchImpl(
      `https://store.steampowered.com/search/results/?query&start=${page * 50}` +
      `&count=50&sort_by=Released_DESC&category1=998&json=1`,
    );
    if (!res.ok) break;
    const j = (await res.json()) as { items?: Array<{ logo?: string }> };
    for (const item of j.items ?? []) {
      const m = /\/apps\/(\d+)\//.exec(item.logo ?? '');
      if (m) ids.push(Number(m[1]));
    }
  }
  return [...new Set(ids)];
}
```

- [ ] **Step 8: Store testlerini çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/steam/store.test.ts`
Expected: PASS (5 test)

- [ ] **Step 9: Commit**

```bash
git add lib/steam/store.ts lib/steam/store.test.ts lib/steamspy/
git commit -m "feat: Store ve SteamSpy metadata istemcileri"
```

---

### Task 6: Kullanıcı zevk vektörü

Review Focus #2 buraya ait: boş vektörde sıfıra bölme.

**Files:**
- Create: `lib/recommend/vector.ts`, `lib/recommend/user-vector.ts`
- Test: `lib/recommend/vector.test.ts`, `lib/recommend/user-vector.test.ts`

**Interfaces:**
- Consumes: `OwnedGame`, `GameMeta`, `TagVector`, `lib/recommend/constants.ts`
- Produces: `l2Normalize(v: TagVector): TagVector`, `cosine(a: TagVector, b: TagVector): number`, `buildUserVector(games: OwnedGame[], metaById: Map<number, GameMeta>, nowSeconds?: number): TagVector`

- [ ] **Step 1: Vektör yardımcıları için testleri yaz**

`lib/recommend/vector.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { l2Normalize, cosine } from './vector';

describe('l2Normalize', () => {
  it('birim uzunluğa indirger', () => {
    const v = l2Normalize(new Map([['a', 3], ['b', 4]]));
    expect(v.get('a')).toBeCloseTo(0.6);
    expect(v.get('b')).toBeCloseTo(0.8);
  });

  it('boş vektörde sıfıra bölmez', () => {
    expect(l2Normalize(new Map()).size).toBe(0);
  });

  it('tüm değerler sıfırsa NaN üretmez', () => {
    const v = l2Normalize(new Map([['a', 0]]));
    expect([...v.values()].every(Number.isFinite)).toBe(true);
  });
});

describe('cosine', () => {
  it('aynı yönde 1 verir', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    expect(cosine(a, a)).toBeCloseTo(1);
  });
  it('ortak etiket yoksa 0 verir', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    const b = l2Normalize(new Map([['y', 1]]));
    expect(cosine(a, b)).toBeCloseTo(0);
  });
  it('boş vektörle 0 verir, NaN değil', () => {
    const a = l2Normalize(new Map([['x', 1]]));
    expect(cosine(a, new Map())).toBe(0);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/vector.test.ts`
Expected: FAIL — `Cannot find module './vector'`

- [ ] **Step 3: Vektör yardımcılarını yaz**

`lib/recommend/vector.ts`:
```ts
import type { TagVector } from '@/lib/steam/types';

export function l2Normalize(v: TagVector): TagVector {
  let sum = 0;
  for (const x of v.values()) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return new Map();
  const out: TagVector = new Map();
  for (const [k, x] of v) out.set(k, x / norm);
  return out;
}

export function cosine(a: TagVector, b: TagVector): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w !== undefined) dot += v * w;
  }
  return dot;
}
```

Not: her iki vektör de L2 normalize olduğu için nokta çarpımı doğrudan kosinüstür.

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/vector.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Kullanıcı vektörü testlerini yaz**

`lib/recommend/user-vector.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildUserVector } from './user-vector';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

function meta(appid: number, tags: Record<string, number>): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)),
    genres: [], releaseDate: '2020-01-01',
    reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
}

const NOW = 1_800_000_000;

describe('buildUserVector', () => {
  it('60 dakikanın altındaki oyunları yok sayar', () => {
    const games: OwnedGame[] = [{ appid: 1, name: 'G1', playtime_forever: 30 }];
    const v = buildUserVector(games, new Map([[1, meta(1, { A: 1 })]]), NOW);
    expect(v.size).toBe(0);
  });

  it('log ölçek kullanır — 2000 saat, 100 saati ezmez', () => {
    const games: OwnedGame[] = [
      { appid: 1, name: 'A', playtime_forever: 2000 * 60 },
      { appid: 2, name: 'B', playtime_forever: 100 * 60 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const v = buildUserVector(games, metas, NOW);
    // log1p(2000)/log1p(100) ≈ 1.65 — lineer olsaydı 20 olurdu
    expect(v.get('A')! / v.get('B')!).toBeLessThan(2);
  });

  it('son iki haftada oynananı öne çıkarır', () => {
    const base: OwnedGame[] = [
      { appid: 1, name: 'A', playtime_forever: 600 },
      { appid: 2, name: 'B', playtime_forever: 600 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const withRecent = buildUserVector(
      [{ ...base[0], playtime_2weeks: 120 }, base[1]], metas, NOW,
    );
    expect(withRecent.get('A')!).toBeGreaterThan(withRecent.get('B')!);
  });

  it('metadata bulunmayan oyunu atlar', () => {
    const games: OwnedGame[] = [{ appid: 99, name: 'X', playtime_forever: 600 }];
    expect(buildUserVector(games, new Map(), NOW).size).toBe(0);
  });

  it('1 yıldan eski, 30 dk altı oyunlara negatif ağırlık verir', () => {
    const games: OwnedGame[] = [
      { appid: 1, name: 'Sevilen', playtime_forever: 600 },
      { appid: 2, name: 'Terk', playtime_forever: 10,
        rtime_last_played: NOW - 400 * 24 * 3600 },
    ];
    const metas = new Map([[1, meta(1, { A: 1 })], [2, meta(2, { B: 1 })]]);
    const v = buildUserVector(games, metas, NOW);
    expect(v.get('B')!).toBeLessThan(0);
  });

  it('hiç uygun oyun yoksa boş vektör döner, NaN üretmez', () => {
    const v = buildUserVector([], new Map(), NOW);
    expect(v.size).toBe(0);
    expect([...v.values()].every(Number.isFinite)).toBe(true);
  });

  it('sonuç L2 normalize edilmiştir', () => {
    const games: OwnedGame[] = [{ appid: 1, name: 'A', playtime_forever: 600 }];
    const v = buildUserVector(games, new Map([[1, meta(1, { A: 3, B: 4 })]]), NOW);
    const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });
});
```

- [ ] **Step 6: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/user-vector.test.ts`
Expected: FAIL — `Cannot find module './user-vector'`

- [ ] **Step 7: Kullanıcı vektörünü yaz**

`lib/recommend/user-vector.ts`:
```ts
import type { GameMeta, OwnedGame, TagVector } from '@/lib/steam/types';
import { l2Normalize } from './vector';
import {
  MIN_PLAYTIME_MINUTES, RECENT_BOOST, NEGATIVE_WEIGHT,
  ABANDONED_MINUTES, ABANDONED_AFTER_SECONDS,
} from './constants';

function add(v: TagVector, tag: string, amount: number): void {
  v.set(tag, (v.get(tag) ?? 0) + amount);
}

export function buildUserVector(
  games: OwnedGame[],
  metaById: Map<number, GameMeta>,
  nowSeconds: number = Date.now() / 1000,
): TagVector {
  const vec: TagVector = new Map();

  for (const g of games) {
    const meta = metaById.get(g.appid);
    if (!meta || meta.tags.size === 0) continue;

    const abandoned =
      g.playtime_forever < ABANDONED_MINUTES &&
      typeof g.rtime_last_played === 'number' &&
      g.rtime_last_played > 0 &&
      nowSeconds - g.rtime_last_played > ABANDONED_AFTER_SECONDS;

    if (abandoned) {
      for (const [tag, tw] of meta.tags) add(vec, tag, -NEGATIVE_WEIGHT * tw);
      continue;
    }

    if (g.playtime_forever < MIN_PLAYTIME_MINUTES) continue;

    let w = Math.log1p(g.playtime_forever / 60);
    if (g.playtime_2weeks && g.playtime_2weeks > 0) w *= RECENT_BOOST;
    for (const [tag, tw] of meta.tags) add(vec, tag, w * tw);
  }

  return l2Normalize(vec);
}
```

- [ ] **Step 8: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/user-vector.test.ts`
Expected: PASS (7 test)

- [ ] **Step 9: Commit**

```bash
git add lib/recommend/vector.ts lib/recommend/user-vector.ts lib/recommend/*.test.ts
git commit -m "feat: oynama süresi ağırlıklı kullanıcı zevk vektörü"
```

---

### Task 7: Kalite kapısı ve skorlama

**Files:**
- Create: `lib/recommend/scoring.ts`
- Test: `lib/recommend/scoring.test.ts`

**Interfaces:**
- Consumes: `cosine` (`./vector`), `GameMeta`, `TagVector`, sabitler
- Produces: `passesQualityGate(m: GameMeta, now: Date): boolean`, `daysSince(iso: string, now: Date): number`, `scoreCandidates(user: TagVector, candidates: Candidate[], ownedIds: Set<number>, now: Date): Scored[]`; tipler `Candidate = {meta: GameMeta; vector: TagVector}`, `Scored = Candidate & {score: number}`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/recommend/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { passesQualityGate, scoreCandidates, daysSince } from './scoring';
import { l2Normalize } from './vector';
import type { GameMeta } from '@/lib/steam/types';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid: 1, name: 'G', tags: new Map([['A', 1]]), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('daysSince', () => {
  it('gün farkını hesaplar', () => {
    expect(daysSince('2026-09-12', NOW)).toBe(10);
  });
});

describe('passesQualityGate', () => {
  it('spec eşiklerini karşılayanı geçirir', () => {
    expect(passesQualityGate(meta(), NOW)).toBe(true);
  });
  it('az incelemeliyi eler', () => {
    expect(passesQualityGate(meta({ reviewCount: 49 }), NOW)).toBe(false);
  });
  it('düşük beğeniliyi eler', () => {
    expect(passesQualityGate(meta({ positiveRatio: 0.69 }), NOW)).toBe(false);
  });
  it('90 günden eskiyi eler', () => {
    expect(passesQualityGate(meta({ releaseDate: '2026-01-01' }), NOW)).toBe(false);
  });
  it('gelecek tarihliyi eler', () => {
    expect(passesQualityGate(meta({ releaseDate: '2027-01-01' }), NOW)).toBe(false);
  });
});

describe('scoreCandidates', () => {
  const user = l2Normalize(new Map([['Souls-like', 1]]));

  it('sahip olunan oyunu listeden çıkarır', () => {
    const c = [{ meta: meta({ appid: 7 }), vector: l2Normalize(new Map([['Souls-like', 1]])) }];
    expect(scoreCandidates(user, c, new Set([7]), NOW)).toHaveLength(0);
  });

  it('zevke yakın olanı üste koyar', () => {
    const c = [
      { meta: meta({ appid: 1 }), vector: l2Normalize(new Map([['Puzzle', 1]])) },
      { meta: meta({ appid: 2 }), vector: l2Normalize(new Map([['Souls-like', 1]])) },
    ];
    expect(scoreCandidates(user, c, new Set(), NOW)[0].meta.appid).toBe(2);
  });

  it('popülerlik sönümlemesi uygular — eşit benzerlikte az sahipli üste çıkar', () => {
    const v = l2Normalize(new Map([['Souls-like', 1]]));
    const c = [
      { meta: meta({ appid: 1, owners: 5_000_000 }), vector: v },
      { meta: meta({ appid: 2, owners: 20_000 }), vector: v },
    ];
    expect(scoreCandidates(user, c, new Set(), NOW)[0].meta.appid).toBe(2);
  });

  it('etiketsiz adayı eler, NaN skor üretmez', () => {
    const c = [{ meta: meta({ appid: 3, tags: new Map() }), vector: new Map() }];
    const out = scoreCandidates(user, c, new Set(), NOW);
    expect(out).toHaveLength(0);
  });

  it('tüm skorlar sonlu sayıdır', () => {
    const c = [{ meta: meta({ appid: 1 }), vector: l2Normalize(new Map([['A', 1]])) }];
    expect(scoreCandidates(user, c, new Set(), NOW).every(s => Number.isFinite(s.score)))
      .toBe(true);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/scoring.test.ts`
Expected: FAIL — `Cannot find module './scoring'`

- [ ] **Step 3: Skorlamayı yaz**

`lib/recommend/scoring.ts`:
```ts
import type { GameMeta, TagVector } from '@/lib/steam/types';
import { cosine } from './vector';
import { MIN_REVIEWS, MIN_POSITIVE_RATIO, RELEASE_WINDOW_DAYS } from './constants';

export interface Candidate { meta: GameMeta; vector: TagVector }
export interface Scored extends Candidate { score: number }

const DAY_MS = 24 * 3600 * 1000;

export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(`${iso}T00:00:00Z`)) / DAY_MS);
}

export function passesQualityGate(m: GameMeta, now: Date): boolean {
  if (m.reviewCount < MIN_REVIEWS) return false;
  if (m.positiveRatio < MIN_POSITIVE_RATIO) return false;
  const d = daysSince(m.releaseDate, now);
  return d >= 0 && d <= RELEASE_WINDOW_DAYS;
}

export function scoreCandidates(
  user: TagVector,
  candidates: Candidate[],
  ownedIds: Set<number>,
  now: Date,
): Scored[] {
  const out: Scored[] = [];
  for (const c of candidates) {
    if (ownedIds.has(c.meta.appid)) continue;
    if (c.vector.size === 0) continue;   // etiketsiz aday skorlanamaz

    const base = cosine(user, c.vector);
    const days = daysSince(c.meta.releaseDate, now);
    const recency = 1 + 0.2 * Math.max(0, 1 - days / RELEASE_WINDOW_DAYS);
    const damp = Math.log1p(Math.max(c.meta.owners, 1)) || 1;

    const score = (base * recency) / damp;
    if (!Number.isFinite(score)) continue;
    out.push({ ...c, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/scoring.test.ts`
Expected: PASS (11 test)

- [ ] **Step 5: Commit**

```bash
git add lib/recommend/scoring.ts lib/recommend/scoring.test.ts
git commit -m "feat: kalite kapısı ve popülerlik sönümlemeli skorlama"
```

---

### Task 8: MMR ile çeşitlilik

**Files:**
- Create: `lib/recommend/mmr.ts`
- Test: `lib/recommend/mmr.test.ts`

**Interfaces:**
- Consumes: `Scored` (`./scoring`), `cosine` (`./vector`), `MMR_LAMBDA`, `MMR_K`
- Produces: `mmrRerank(scored: Scored[], lambda?: number, k?: number): Scored[]`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/recommend/mmr.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mmrRerank } from './mmr';
import { l2Normalize } from './vector';
import type { Scored } from './scoring';
import type { GameMeta } from '@/lib/steam/types';

function cand(appid: number, tag: string, score: number): Scored {
  const meta: GameMeta = {
    appid, name: `G${appid}`, tags: new Map([[tag, 1]]), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
  return { meta, vector: l2Normalize(new Map([[tag, 1]])), score };
}

describe('mmrRerank', () => {
  it('tek tip listeyi çeşitlendirir', () => {
    const input = [
      cand(1, 'Souls-like', 0.90),
      cand(2, 'Souls-like', 0.89),
      cand(3, 'Puzzle', 0.50),
    ];
    const out = mmrRerank(input, 0.5, 3);
    expect(out[0].meta.appid).toBe(1);
    // İkinci sırada aynı etiketin kopyası değil, farklı tür gelmeli
    expect(out[1].meta.appid).toBe(3);
  });

  it('lambda=1 ise saf skor sırasını korur', () => {
    const input = [cand(1, 'A', 0.9), cand(2, 'A', 0.8), cand(3, 'B', 0.7)];
    expect(mmrRerank(input, 1, 3).map(s => s.meta.appid)).toEqual([1, 2, 3]);
  });

  it('en fazla k eleman döner', () => {
    const input = [cand(1, 'A', 0.9), cand(2, 'B', 0.8), cand(3, 'C', 0.7)];
    expect(mmrRerank(input, 0.7, 2)).toHaveLength(2);
  });

  it('boş girdide boş döner', () => {
    expect(mmrRerank([], 0.7, 10)).toEqual([]);
  });

  it('k girdi sayısından büyükse hepsini döner', () => {
    const input = [cand(1, 'A', 0.9)];
    expect(mmrRerank(input, 0.7, 10)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/mmr.test.ts`
Expected: FAIL — `Cannot find module './mmr'`

- [ ] **Step 3: MMR'ı yaz**

`lib/recommend/mmr.ts`:
```ts
import type { Scored } from './scoring';
import { cosine } from './vector';
import { MMR_LAMBDA, MMR_K } from './constants';

/**
 * Maximal Marginal Relevance: ilk 10'un 10'u da aynı türden olmasın diye
 * alaka ile çeşitlilik arasında denge kurarak yeniden sıralar.
 */
export function mmrRerank(
  scored: Scored[],
  lambda: number = MMR_LAMBDA,
  k: number = MMR_K,
): Scored[] {
  const pool = [...scored];
  const selected: Scored[] = [];

  while (selected.length < k && pool.length > 0) {
    let bestIdx = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      let maxSim = 0;
      for (const s of selected) {
        const sim = cosine(pool[i].vector, s.vector);
        if (sim > maxSim) maxSim = sim;
      }
      const value = lambda * pool[i].score - (1 - lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  return selected;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/mmr.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add lib/recommend/mmr.ts lib/recommend/mmr.test.ts
git commit -m "feat: MMR ile öneri çeşitliliği"
```

---

### Task 9: Gerekçe üretimi

Her öneri "neden" taşır — hem UX hem KVKK şeffaflık yükümlülüğü.

**Files:**
- Create: `lib/recommend/explain.ts`
- Test: `lib/recommend/explain.test.ts`

**Interfaces:**
- Consumes: `OwnedGame`, `GameMeta`, `TagVector` (`lib/steam/types.ts`), `Candidate` (`./scoring`), `MIN_PLAYTIME_MINUTES`
- Produces: `explainRecommendation(user: TagVector, candidate: Candidate, games: OwnedGame[], metaById: Map<number, GameMeta>): Explanation`; tip `Explanation = {topTags: string[]; drivingGames: Array<{name: string; hours: number}>; text: string}`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/recommend/explain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { explainRecommendation } from './explain';
import { l2Normalize } from './vector';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

function meta(appid: number, tags: Record<string, number>): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9, owners: 1000,
  };
}

describe('explainRecommendation', () => {
  const user = l2Normalize(new Map([['Metroidvania', 0.8], ['Souls-like', 0.6]]));
  const candidate = {
    meta: { ...meta(9, { Metroidvania: 1, 'Souls-like': 0.5 }), name: 'Yeni Oyun' },
    vector: l2Normalize(new Map([['Metroidvania', 1], ['Souls-like', 0.5]])),
  };
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
    { appid: 2, name: 'Dead Cells', playtime_forever: 4800 },
    { appid: 3, name: 'Alakasız Oyun', playtime_forever: 6000 },
  ];
  const metas = new Map([
    [1, meta(1, { Metroidvania: 1 })],
    [2, meta(2, { Metroidvania: 0.8, 'Souls-like': 1 })],
    [3, meta(3, { Tarım: 1 })],
  ]);

  it('en çok katkı veren etiketleri döner', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.topTags[0]).toBe('Metroidvania');
    expect(e.topTags.length).toBeLessThanOrEqual(3);
  });

  it('o etiketleri taşıyan oyunları gerekçe olarak gösterir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    const names = e.drivingGames.map(g => g.name);
    expect(names).toContain('Hollow Knight');
    expect(names).not.toContain('Alakasız Oyun');
  });

  it('saat cinsinden süre verir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.drivingGames[0].hours).toBe(120);
  });

  it('okunabilir Türkçe metin üretir', () => {
    const e = explainRecommendation(user, candidate, games, metas);
    expect(e.text).toContain('Hollow Knight');
    expect(e.text).toContain('Metroidvania');
  });

  it('ortak etiket yoksa boş gerekçeyle çökmeden döner', () => {
    const e = explainRecommendation(
      l2Normalize(new Map([['Tarım', 1]])),
      { meta: meta(9, { Yarış: 1 }), vector: l2Normalize(new Map([['Yarış', 1]])) },
      games, metas,
    );
    expect(e.topTags).toEqual([]);
    expect(typeof e.text).toBe('string');
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/explain.test.ts`
Expected: FAIL — `Cannot find module './explain'`

- [ ] **Step 3: Gerekçe üreticisini yaz**

`lib/recommend/explain.ts`:
```ts
import type { GameMeta, OwnedGame, TagVector } from '@/lib/steam/types';
import type { Candidate } from './scoring';
import { MIN_PLAYTIME_MINUTES } from './constants';

export interface Explanation {
  topTags: string[];
  drivingGames: Array<{ name: string; hours: number }>;
  text: string;
}

export function explainRecommendation(
  user: TagVector,
  candidate: Candidate,
  games: OwnedGame[],
  metaById: Map<number, GameMeta>,
): Explanation {
  // Skora en çok katkı veren etiketler: kullanıcı ve aday ağırlığının çarpımı
  const contributions: Array<[string, number]> = [];
  for (const [tag, cw] of candidate.vector) {
    const uw = user.get(tag);
    if (uw !== undefined && uw > 0) contributions.push([tag, uw * cw]);
  }
  contributions.sort((a, b) => b[1] - a[1]);
  const topTags = contributions.slice(0, 3).map(([t]) => t);

  // O etiketleri taşıyan, en çok oynanmış oyunlar
  const tagSet = new Set(topTags);
  const driving = games
    .filter((g) => {
      if (g.playtime_forever < MIN_PLAYTIME_MINUTES) return false;
      const m = metaById.get(g.appid);
      if (!m) return false;
      for (const t of m.tags.keys()) if (tagSet.has(t)) return true;
      return false;
    })
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 2)
    .map((g) => ({ name: g.name, hours: Math.round(g.playtime_forever / 60) }));

  const text =
    driving.length > 0 && topTags.length > 0
      ? `${driving.map((g) => `${g.name} (${g.hours} saat)`).join(' ve ')} ` +
        `oynadınız — ${topTags.join(', ')} ağırlığınız yüksek.`
      : 'Kütüphanenizdeki genel eğilime göre seçildi.';

  return { topTags, drivingGames: driving, text };
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/explain.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add lib/recommend/explain.ts lib/recommend/explain.test.ts
git commit -m "feat: öneri gerekçesi üretimi"
```

---

### Task 10: Katalog cache ve aday havuzu tazeleme

**Files:**
- Create: `lib/catalog/db.ts`, `lib/catalog/refresh.ts`, `scripts/refresh-catalog.ts`
- Test: `lib/catalog/db.test.ts`

**Interfaces:**
- Consumes: `GameMeta`, `fetchStoreDetails`, `fetchNewReleaseAppIds`, `fetchSteamSpyTags`, `passesQualityGate`
- Produces: `openDb(path?: string): Database`, `upsertGameMeta(db, m: GameMeta): void`, `getCandidatePool(db, now: Date): Candidate[]`, `refreshCatalog(db, deps): Promise<{added: number; skipped: number}>`

- [ ] **Step 1: DB testlerini yaz**

`lib/catalog/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb, upsertGameMeta, getCandidatePool } from './db';
import type { GameMeta } from '@/lib/steam/types';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid: 1, name: 'G', tags: new Map([['A', 1], ['B', 0.5]]), genres: ['Action'],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('katalog db', () => {
  it('yazıp geri okur, etiket Map’i korunur', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta());
    const pool = getCandidatePool(db, NOW);
    expect(pool).toHaveLength(1);
    expect(pool[0].meta.tags.get('A')).toBeCloseTo(1);
    expect(pool[0].meta.tags.get('B')).toBeCloseTo(0.5);
  });

  it('aynı appid tekrar yazılınca çoğalmaz, günceller', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ name: 'Eski' }));
    upsertGameMeta(db, meta({ name: 'Yeni' }));
    const pool = getCandidatePool(db, NOW);
    expect(pool).toHaveLength(1);
    expect(pool[0].meta.name).toBe('Yeni');
  });

  it('kalite kapısını geçmeyeni havuza koymaz', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 2, reviewCount: 10 }));
    expect(getCandidatePool(db, NOW)).toHaveLength(0);
  });

  it('90 günden eskiyi havuza koymaz', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 3, releaseDate: '2025-01-01' }));
    expect(getCandidatePool(db, NOW)).toHaveLength(0);
  });

  it('havuzdaki her adayın normalize vektörü vardır', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta());
    const norm = Math.sqrt(
      [...getCandidatePool(db, NOW)[0].vector.values()].reduce((s, x) => s + x * x, 0),
    );
    expect(norm).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/catalog/db.test.ts`
Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 3: DB katmanını yaz**

`lib/catalog/db.ts`:
```ts
import Database from 'better-sqlite3';
import type { GameMeta } from '@/lib/steam/types';
import type { Candidate } from '@/lib/recommend/scoring';
import { passesQualityGate } from '@/lib/recommend/scoring';
import { l2Normalize } from '@/lib/recommend/vector';

export type Db = Database.Database;

// Bu tablo KAMUYA AÇIK oyun katalogudur, kişisel veri içermez.
// Katman 0 (stateless) modunda bile mevcuttur.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_meta (
  appid          INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  tags_json      TEXT NOT NULL,
  genres_json    TEXT NOT NULL,
  release_date   TEXT NOT NULL,
  review_count   INTEGER NOT NULL,
  positive_ratio REAL NOT NULL,
  owners         INTEGER NOT NULL,
  fetched_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_release ON game_meta(release_date);
`;

export function openDb(path = 'data/catalog.db'): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function upsertGameMeta(db: Db, m: GameMeta): void {
  db.prepare(`
    INSERT INTO game_meta
      (appid, name, tags_json, genres_json, release_date,
       review_count, positive_ratio, owners, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(appid) DO UPDATE SET
      name=excluded.name, tags_json=excluded.tags_json,
      genres_json=excluded.genres_json, release_date=excluded.release_date,
      review_count=excluded.review_count, positive_ratio=excluded.positive_ratio,
      owners=excluded.owners, fetched_at=excluded.fetched_at
  `).run(
    m.appid, m.name,
    JSON.stringify(Object.fromEntries(m.tags)),
    JSON.stringify(m.genres),
    m.releaseDate, m.reviewCount, m.positiveRatio, m.owners,
    Math.floor(Date.now() / 1000),
  );
}

interface Row {
  appid: number; name: string; tags_json: string; genres_json: string;
  release_date: string; review_count: number; positive_ratio: number; owners: number;
}

export function getCandidatePool(db: Db, now: Date): Candidate[] {
  const rows = db.prepare('SELECT * FROM game_meta').all() as Row[];
  const out: Candidate[] = [];
  for (const r of rows) {
    const meta: GameMeta = {
      appid: r.appid,
      name: r.name,
      tags: new Map(Object.entries(JSON.parse(r.tags_json) as Record<string, number>)),
      genres: JSON.parse(r.genres_json) as string[],
      releaseDate: r.release_date,
      reviewCount: r.review_count,
      positiveRatio: r.positive_ratio,
      owners: r.owners,
    };
    if (!passesQualityGate(meta, now)) continue;
    if (meta.tags.size === 0) continue;
    out.push({ meta, vector: l2Normalize(meta.tags) });
  }
  return out;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/catalog/db.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Tazeleme işini yaz**

`lib/catalog/refresh.ts`:
```ts
import type { Db } from './db';
import { upsertGameMeta } from './db';
import { fetchNewReleaseAppIds, fetchStoreDetails } from '@/lib/steam/store';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Yeni çıkanları toplayıp katalogu tazeler.
 * SteamSpy ~1 istek/sn, Store ~200 istek/5dk sınırına saygı duyar.
 */
export async function refreshCatalog(
  db: Db,
  opts: { pages?: number; delayMs?: number } = {},
): Promise<{ added: number; skipped: number }> {
  const { pages = 4, delayMs = 1100 } = opts;
  const appIds = await fetchNewReleaseAppIds(fetch, pages);

  let added = 0;
  let skipped = 0;

  for (const appid of appIds) {
    try {
      const store = await fetchStoreDetails(appid);
      if (!store) { skipped++; continue; }
      await sleep(delayMs);

      const spy = await fetchSteamSpyTags(appid);
      // Etiketsiz oyun skorlanamaz — havuza alma.
      if (spy.tags.size === 0) { skipped++; continue; }

      const reviews = spy.positive + spy.negative;
      upsertGameMeta(db, {
        appid,
        name: store.name,
        tags: spy.tags,
        genres: store.genres,
        releaseDate: store.releaseDate,
        reviewCount: reviews,
        positiveRatio: reviews > 0 ? spy.positive / reviews : 0,
        owners: spy.owners,
      });
      added++;
    } catch {
      // Tek oyunun hatası tüm tazelemeyi düşürmesin.
      skipped++;
    }
    await sleep(delayMs);
  }
  return { added, skipped };
}
```

`scripts/refresh-catalog.ts`:
```ts
import { openDb } from '@/lib/catalog/db';
import { refreshCatalog } from '@/lib/catalog/refresh';

const db = openDb();
refreshCatalog(db)
  .then((r) => { console.log(`Katalog tazelendi: +${r.added}, atlanan ${r.skipped}`); })
  .catch((e) => { console.error(e); process.exit(1); });
```

`package.json` scripts'e ekle: `"refresh:catalog": "tsx scripts/refresh-catalog.ts"` ve `npm i -D tsx`.

- [ ] **Step 6: Tüm testleri çalıştır**

Run: `npm test`
Expected: PASS (tüm dosyalar)

- [ ] **Step 7: Commit**

```bash
git add lib/catalog/ scripts/refresh-catalog.ts package.json
git commit -m "feat: katalog cache ve aday havuzu tazeleme"
```

---

### Task 11: Rıza katmanları ve metin versiyonlama

Review Focus #5 buraya ait.

**Files:**
- Create: `lib/consent/versions.ts`
- Test: `lib/consent/versions.test.ts`

**Interfaces:**
- Consumes: yok
- Produces: `CONSENT_TEXT_VERSION`, `PRIVACY_NOTICE_VERSION`, `ConsentLayer` enum, `isConsentValid(record: {layer, granted, textVersion}, layer): boolean`

- [ ] **Step 1: Başarısız testleri yaz**

`lib/consent/versions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isConsentValid, CONSENT_TEXT_VERSION, ConsentLayer } from './versions';

describe('isConsentValid', () => {
  it('güncel versiyonlu onayı geçerli sayar', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(true);
  });

  it('eski versiyonlu onayı GEÇERSİZ sayar — kullanıcı o metni hiç görmedi', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: true, textVersion: CONSENT_TEXT_VERSION - 1 },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('reddedilmiş onayı geçersiz sayar', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: false, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('başka katmanın onayı bu katmanı kapsamaz', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Email, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/consent/versions.test.ts`
Expected: FAIL — `Cannot find module './versions'`

- [ ] **Step 3: Uygulamayı yaz**

`lib/consent/versions.ts`:
```ts
/**
 * Metin her değiştiğinde versiyon ARTIRILIR. Eski versiyona verilmiş onay
 * yeni metni kapsamaz (KVKK m.3/1-a: bilgilendirmeye dayanma) ve tekrar sorulur.
 */
export const PRIVACY_NOTICE_VERSION = 1;  // aydınlatma metni
export const CONSENT_TEXT_VERSION = 1;    // açık rıza metni

export enum ConsentLayer {
  /** Katman 0 — sözleşmenin ifası, açık rıza gerektirmez. Kayıt yapılmaz. */
  Ephemeral = 'ephemeral',
  /** Katman 1 — profil ve öneri geçmişi saklama. */
  Storage = 'storage',
  /** Katman 2 — e-posta bildirimi. */
  Email = 'email',
  /** Katman 3 — anonimleştirilmiş analitik. */
  Analytics = 'analytics',
}

export interface ConsentRecord {
  layer: ConsentLayer;
  granted: boolean;
  textVersion: number;
}

export function isConsentValid(record: ConsentRecord, layer: ConsentLayer): boolean {
  if (record.layer !== layer) return false;
  if (!record.granted) return false;
  return record.textVersion === CONSENT_TEXT_VERSION;
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/consent/versions.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add lib/consent/
git commit -m "feat: katmanlı rıza modeli ve metin versiyonlama"
```

---

### Task 12: Öneri API route'u

**Files:**
- Create: `app/api/recommend/route.ts`, `lib/recommend/pipeline.ts`
- Test: `lib/recommend/pipeline.test.ts`

**Interfaces:**
- Consumes: `buildUserVector`, `scoreCandidates`, `mmrRerank`, `explainRecommendation`, `getCandidatePool`
- Produces: `recommend(input: {games: OwnedGame[]; metaById: Map<number, GameMeta>; pool: Candidate[]; now: Date}): Recommendation[]`; tip `Recommendation = Scored & {explanation: Explanation}`

- [ ] **Step 1: Boru hattı testlerini yaz**

`lib/recommend/pipeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { recommend } from './pipeline';
import { l2Normalize } from './vector';
import type { GameMeta, OwnedGame } from '@/lib/steam/types';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(appid: number, tags: Record<string, number>, over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid, name: `G${appid}`, tags: new Map(Object.entries(tags)), genres: [],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('recommend', () => {
  const games: OwnedGame[] = [
    { appid: 1, name: 'Hollow Knight', playtime_forever: 7200 },
  ];
  const metaById = new Map([[1, meta(1, { Metroidvania: 1 })]]);
  const pool = [
    { meta: meta(50, { Metroidvania: 1 }, { name: 'Yeni Metroid' }),
      vector: l2Normalize(new Map([['Metroidvania', 1]])) },
    { meta: meta(51, { Tarım: 1 }, { name: 'Çiftlik' }),
      vector: l2Normalize(new Map([['Tarım', 1]])) },
  ];

  it('uygun oyunu üste koyar ve gerekçe taşır', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out[0].meta.name).toBe('Yeni Metroid');
    expect(out[0].explanation.text).toContain('Hollow Knight');
  });

  it('kullanıcının sahip olduğu oyunu önermez', () => {
    const poolWithOwned = [
      { meta: meta(1, { Metroidvania: 1 }), vector: l2Normalize(new Map([['Metroidvania', 1]])) },
      ...pool,
    ];
    const out = recommend({ games, metaById, pool: poolWithOwned, now: NOW });
    expect(out.map(r => r.meta.appid)).not.toContain(1);
  });

  it('boş kütüphanede çökmeden boş liste döner', () => {
    const out = recommend({ games: [], metaById: new Map(), pool, now: NOW });
    expect(out).toEqual([]);
  });

  it('tüm skorlar sonludur', () => {
    const out = recommend({ games, metaById, pool, now: NOW });
    expect(out.every(r => Number.isFinite(r.score))).toBe(true);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `npx vitest run lib/recommend/pipeline.test.ts`
Expected: FAIL — `Cannot find module './pipeline'`

- [ ] **Step 3: Boru hattını yaz**

`lib/recommend/pipeline.ts`:
```ts
import type { GameMeta, OwnedGame } from '@/lib/steam/types';
import type { Candidate, Scored } from './scoring';
import { scoreCandidates } from './scoring';
import { buildUserVector } from './user-vector';
import { mmrRerank } from './mmr';
import { explainRecommendation, type Explanation } from './explain';

export interface Recommendation extends Scored {
  explanation: Explanation;
}

export function recommend(input: {
  games: OwnedGame[];
  metaById: Map<number, GameMeta>;
  pool: Candidate[];
  now: Date;
}): Recommendation[] {
  const { games, metaById, pool, now } = input;

  const user = buildUserVector(games, metaById, now.getTime() / 1000);
  if (user.size === 0) return [];   // zevk çıkarılamadı, tahmin uydurma

  const owned = new Set(games.map((g) => g.appid));
  const scored = scoreCandidates(user, pool, owned, now);
  const diversified = mmrRerank(scored);

  return diversified.map((s) => ({
    ...s,
    explanation: explainRecommendation(user, s, games, metaById),
  }));
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `npx vitest run lib/recommend/pipeline.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: API route'u yaz**

`app/api/recommend/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { openDb, getCandidatePool } from '@/lib/catalog/db';
import { getOwnedGames } from '@/lib/steam/client';
import { fetchSteamSpyTags } from '@/lib/steamspy/client';
import { resolveToSteamId64 } from '@/lib/steam/profile-url';
import { recommend } from '@/lib/recommend/pipeline';
import {
  PrivateProfileError, VanityNotFoundError, InvalidProfileUrlError,
  type GameMeta,
} from '@/lib/steam/types';
import { MIN_PLAYTIME_MINUTES } from '@/lib/recommend/constants';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
  }

  let body: { profile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  if (!body.profile) {
    return NextResponse.json({ error: 'Profil adresi gerekli.' }, { status: 400 });
  }

  try {
    const steamId = await resolveToSteamId64(body.profile, apiKey);
    const games = await getOwnedGames(steamId, apiKey);

    // Yalnızca anlamlı süre oynanmış oyunların metadata'sı çekilir
    // (veri minimizasyonu + rate limit).
    const relevant = games
      .filter((g) => g.playtime_forever >= MIN_PLAYTIME_MINUTES)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 60);

    const metaById = new Map<number, GameMeta>();
    for (const g of relevant) {
      try {
        const spy = await fetchSteamSpyTags(g.appid);
        if (spy.tags.size === 0) continue;
        metaById.set(g.appid, {
          appid: g.appid, name: g.name, tags: spy.tags, genres: [],
          releaseDate: '1970-01-01',
          reviewCount: spy.positive + spy.negative,
          positiveRatio: spy.positive + spy.negative > 0
            ? spy.positive / (spy.positive + spy.negative) : 0,
          owners: spy.owners,
        });
      } catch {
        continue;   // tek oyunun metadata hatası isteği düşürmesin
      }
    }

    const db = openDb();
    const pool = getCandidatePool(db, new Date());
    const results = recommend({ games, metaById, pool, now: new Date() });

    // Katman 0: hiçbir kişisel veri kaydedilmez. Yanıt üretilir ve unutulur.
    return NextResponse.json({
      count: results.length,
      recommendations: results.map((r) => ({
        appid: r.meta.appid,
        name: r.meta.name,
        score: Number(r.score.toFixed(4)),
        releaseDate: r.meta.releaseDate,
        reason: r.explanation.text,
        tags: r.explanation.topTags,
      })),
    });
  } catch (e) {
    if (e instanceof PrivateProfileError) {
      return NextResponse.json({ error: 'private_profile' }, { status: 409 });
    }
    if (e instanceof VanityNotFoundError) {
      return NextResponse.json({ error: 'vanity_not_found' }, { status: 404 });
    }
    if (e instanceof InvalidProfileUrlError) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Tüm testleri çalıştır**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/recommend/pipeline.ts lib/recommend/pipeline.test.ts app/api/recommend/
git commit -m "feat: öneri boru hattı ve API route"
```

---

### Task 13: OpenID giriş route'ları

**Files:**
- Create: `app/api/auth/steam/route.ts`, `app/api/auth/steam/callback/route.ts`

**Interfaces:**
- Consumes: `buildLoginUrl`, `verifyCallback` (`lib/steam/openid.ts`)
- Produces: `/api/auth/steam` (302 → Steam), `/api/auth/steam/callback` (doğrular, `steam_id` çerezi kurar)

- [ ] **Step 1: Giriş başlatma route'unu yaz**

`app/api/auth/steam/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { buildLoginUrl } from '@/lib/steam/openid';

export const runtime = 'nodejs';

export async function GET() {
  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    return NextResponse.json({ error: 'APP_ORIGIN tanımlı değil.' }, { status: 500 });
  }
  return NextResponse.redirect(
    buildLoginUrl(`${origin}/api/auth/steam/callback`, origin),
  );
}
```

- [ ] **Step 2: Callback route'unu yaz**

`app/api/auth/steam/callback/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { verifyCallback } from '@/lib/steam/openid';
import { OpenIdVerificationError } from '@/lib/steam/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const origin = process.env.APP_ORIGIN ?? '';
  const params = new URL(req.url).searchParams;

  try {
    // Gelen parametrelere DOĞRUDAN güvenilmez; Steam'e geri doğrulatılır.
    const steamId = await verifyCallback(params);
    const res = NextResponse.redirect(`${origin}/oneriler`);
    res.cookies.set('steam_id', steamId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    if (e instanceof OpenIdVerificationError) {
      return NextResponse.redirect(`${origin}/?hata=giris`);
    }
    return NextResponse.redirect(`${origin}/?hata=bilinmeyen`);
  }
}
```

- [ ] **Step 3: Elle doğrula**

Run: `npm run dev`, tarayıcıda `http://localhost:3000/api/auth/steam` aç.
Expected: Steam giriş sayfasına yönlenir; giriş sonrası `/oneriler`'e dönülür ve `steam_id` çerezi kurulmuş olur.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/
git commit -m "feat: Steam OpenID giriş ve callback route'ları"
```

---

### Task 14: Arayüz — giriş, sonuç listesi, gizli profil yardımı

shadcn/ui kurulumu bu task'a dahildir.

**Files:**
- Create: `components/GameCard.tsx`, `components/PrivacyHelp.tsx`
- Modify: `app/page.tsx`
- Create: `app/oneriler/page.tsx`

**Interfaces:**
- Consumes: `/api/recommend`, `/api/auth/steam`
- Produces: kullanıcıya görünen akış

- [ ] **Step 1: shadcn/ui kur**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input alert
```

- [ ] **Step 2: Gizli profil yardımını yaz**

`components/PrivacyHelp.tsx`:
```tsx
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
```

- [ ] **Step 3: Öneri kartını yaz**

`components/GameCard.tsx`:
```tsx
interface Props {
  appid: number;
  name: string;
  releaseDate: string;
  reason: string;
  tags: string[];
}

export function GameCard({ appid, name, releaseDate, reason, tags }: Props) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        <time className="text-xs text-muted-foreground">{releaseDate}</time>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs">{t}</span>
        ))}
      </div>

      <a
        href={`https://store.steampowered.com/app/${appid}/`}
        target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-block text-sm underline"
      >
        Steam&apos;de gör
      </a>
    </article>
  );
}
```

- [ ] **Step 4: Giriş sayfasını yaz**

`app/page.tsx`: iki yol sunar — OpenID girişi (ana) ve link yapıştırma (stateless demo). Link kutusunun altında şu uyarı görünür:

```tsx
<p className="text-xs text-muted-foreground">
  Link ile deneme modunda hiçbir veri kaydedilmez. Başkasının profilini
  girerseniz o kişi bu işleme onay vermemiş olur — kendi profilinizi girin.
</p>
```

Sayfa ayrıca aydınlatma metni ve açık rıza metnine **ayrı** bağlantılar taşır ve giriş butonunun yanında ön işaretli olmayan tek bir onay kutusu bulunur.

- [ ] **Step 5: Sonuç sayfasını yaz**

`app/oneriler/page.tsx`: `/api/recommend`'e POST atar. Yanıt `error: 'private_profile'` ise `<PrivacyHelp />`, `vanity_not_found` ise "Bu özel adrese sahip profil bulunamadı", `invalid_url` ise "Adresi kontrol edin" gösterir. `count: 0` ise "Kütüphanenizde 60 dakikadan fazla oynanmış yeterli oyun bulamadık" mesajı verir — boş liste ile hata ayrı ayrı ele alınır.

- [ ] **Step 6: Elle doğrula**

Run: `npm run dev`
Expected: Giriş → öneri listesi; gizli profille test edildiğinde `PrivacyHelp` görünür.

- [ ] **Step 7: Commit**

```bash
git add components/ app/page.tsx app/oneriler/
git commit -m "feat: giriş, öneri listesi ve gizli profil yardımı arayüzü"
```

---

### Task 15: Aydınlatma metni ve açık rıza metni sayfaları

KVKK m.10 ve m.3/1-a — **iki ayrı belge**, birbirine gömülmez.

**Files:**
- Create: `app/aydinlatma-metni/page.tsx`, `app/acik-riza/page.tsx`

**Interfaces:**
- Consumes: `PRIVACY_NOTICE_VERSION`, `CONSENT_TEXT_VERSION` (`lib/consent/versions.ts`)
- Produces: iki statik sayfa

> **Bu task'ta hazır metin verilmiyor — bilerek.** Aydınlatma metni veri
> sorumlusunun gerçek kimliğini, iletişim ve başvuru adresini içermek zorunda;
> bunlar yalnızca proje sahibinin bilebileceği bilgiler. Uydurma tüzel kişi
> bilgisi içeren bir KVKK metni, metin olmamasından daha kötüdür. Aşağıdaki
> maddeler zorunlu içerik listesidir; her biri gerçek bilgiyle doldurulur.
> Yayına çıkmadan önce metinler bir hukukçuya okutulmalıdır.

- [ ] **Step 1: Aydınlatma metnini yaz**

`app/aydinlatma-metni/page.tsx` şu başlıkları içerir:
- Veri sorumlusunun kimliği ve iletişim bilgisi
- İşlenen veri kategorileri: Steam kullanıcı kimliği (SteamID64), görünen ad, avatar, sahip olunan oyunlar ve oynama süreleri
- İşleme amacı: yalnızca oyun önerisi üretmek
- Hukuki sebep: Katman 0 için sözleşmenin ifası (m.5/2-c); Katman 1+ için açık rıza
- Saklama süresi: **Katman 0'da veri saklanmaz**, yanıt üretildikten sonra bellekten düşer
- Aktarım: üçüncü kişiye aktarılmaz; Steam ve SteamSpy'a yalnızca sorgu yapılır
- Arkadaş listesinin **işlenmediğinin** açık beyanı
- m.11 hakları ve başvuru yolu
- Sayfa altında `PRIVACY_NOTICE_VERSION` görünür

- [ ] **Step 2: Açık rıza metnini yaz**

`app/acik-riza/page.tsx`:
- Aydınlatma metnine bağlantı verir, içeriğini **tekrarlamaz**
- Her katman ayrı başlık altında, ne için onay istendiği tek cümleyle
- Katman 0'ın açık rıza gerektirmediği, rızanın yalnızca Katman 1+ için olduğu açıkça yazılır
- Rızanın geri alınabileceği ve nasıl geri alınacağı
- Sayfa altında `CONSENT_TEXT_VERSION` görünür

- [ ] **Step 3: Elle doğrula**

Run: `npm run dev`, `/aydinlatma-metni` ve `/acik-riza` sayfalarını aç.
Expected: İki sayfa ayrı ayrı açılır, birbirine bağlantı verir, versiyon numaraları görünür.

- [ ] **Step 4: Tüm testleri çalıştır**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/aydinlatma-metni/ app/acik-riza/
git commit -m "feat: aydınlatma metni ve açık rıza metni sayfaları"
```

---

## Faz 1 Tamamlanma Ölçütü

- [ ] `npm test` tamamen yeşil
- [ ] OpenID girişi uçtan uca çalışıyor
- [ ] Gizli profil anlamlı yönerge gösteriyor (sessiz hata yok)
- [ ] Boş kütüphane ile gizli profil **farklı** mesaj alıyor
- [ ] Her öneri gerekçe taşıyor
- [ ] Kişisel veri veritabanına yazılmıyor (`data/catalog.db` yalnızca `game_meta` içeriyor)
- [ ] Aydınlatma ve açık rıza metinleri ayrı sayfalarda

## Sonraki Fazlar

**Faz 2:** Katman 1 opt-in saklama (Postgres), öneri geçmişi, "bunu bir daha gösterme", Verilerim sayfası (JSON dışa aktarma + kalıcı silme), 6 ay hareketsizlik sonrası otomatik silme.

**Faz 3:** Katman 2 e-posta bildirimi, Katman 3 anonimleştirilmiş analitik.
