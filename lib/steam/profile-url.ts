import { InvalidProfileUrlError, VanityNotFoundError } from './types';

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

export async function resolveToSteamId64(
  input: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const parsed = parseProfileUrl(input);
  if (parsed.kind === 'id64') return parsed.id;

  const url =
    `${API}/ISteamUser/ResolveVanityURL/v1/` +
    `?key=${encodeURIComponent(apiKey)}&vanityurl=${encodeURIComponent(parsed.vanity)}`;
  const res = await fetchImpl(url);
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
  return json.response.steamid;
}
