import { InvalidProfileUrlError, VanityNotFoundError } from './types';
import { fetchWithTimeout } from '@/lib/http/fetch';
import { STEAM_API_TIMEOUT_MS } from '@/lib/http/constants';

const API = 'https://api.steampowered.com';
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
  // Tam eşleşme şart: substring/endsWith gibi gevşek kontroller
  // "steamcommunity.com.evil.example" veya "evilsteamcommunity.com" gibi
  // sahte alan adlarının geçmesine izin verir.
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

export interface ResolvedProfile {
  steamId: string;
  /**
   * SteamID64'ün nereden geldiği. Bu ayrım R26 için ZORUNLUDUR:
   *
   * - `vanity`: `ResolveVanityURL` başarılı döndüyse profil VARDIR
   *   (bulunmayan özel adres için Steam `success: 42` verir). Varlığı
   *   ayrıca doğrulamak gereksiz bir ağ turu olur.
   * - `id64`: kullanıcı ham bir sayı yapıştırdı; hiçbir şey doğrulanmadı.
   *   Steam, VAR OLMAYAN bir oyuncu için de `GetOwnedGames`'te boş
   *   `{"response":{}}` döndürür — yani "gizli profil" ile "böyle bir hesap
   *   yok" aynı yanıta çıkar. Bu durumda kullanıcıya var olmayan bir hesap
   *   için "gizlilik ayarlarını değiştir" demek YANLIŞTIR; çağıran, varlığı
   *   `getPlayerSummary` ile ayırt etmelidir.
   */
  kind: ParsedProfile['kind'];
}

export async function resolveProfile(
  input: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedProfile> {
  const parsed = parseProfileUrl(input);
  if (parsed.kind === 'id64') return { steamId: parsed.id, kind: 'id64' };

  const url =
    `${API}/ISteamUser/ResolveVanityURL/v1/` +
    `?key=${encodeURIComponent(apiKey)}&vanityurl=${encodeURIComponent(parsed.vanity)}`;
  const res = await fetchWithTimeout(fetchImpl, url, STEAM_API_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error('Steam API isteği başarısız oldu.');
  }
  const json = (await res.json()) as {
    response?: { success?: number; steamid?: string };
  };
  // Steam, vanity adı eşleşmediğinde de HTTP 200 döner (success: 42).
  // res.ok kontrolü bu durumu yakalamaz; ayrıca kontrol edilmeli.
  if (json.response?.success !== 1 || !json.response.steamid) {
    throw new VanityNotFoundError('Bu özel adrese sahip bir profil bulunamadı.');
  }
  return { steamId: json.response.steamid, kind: 'vanity' };
}

/** Yalnızca SteamID64'e ihtiyaç duyan çağıranlar için ince sarmalayıcı. */
export async function resolveToSteamId64(
  input: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  return (await resolveProfile(input, apiKey, fetchImpl)).steamId;
}
