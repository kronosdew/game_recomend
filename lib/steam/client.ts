import { OwnedGame, PrivateProfileError, ProfileNotFoundError } from './types';
import { fetchWithTimeout } from '@/lib/http/fetch';
import { STEAM_API_TIMEOUT_MS } from '@/lib/http/constants';

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

  const res = await fetchWithTimeout(fetchImpl, url, STEAM_API_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error('Steam API isteği başarısız oldu.');
  }
  const json = (await res.json()) as {
    response?: { game_count?: number; games?: OwnedGame[] };
  };

  // Oyun detayları gizliyse Steam hata vermez, boş response döner (HTTP 200).
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
  const res = await fetchWithTimeout(fetchImpl, url, STEAM_API_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error('Steam API isteği başarısız oldu.');
  }
  const json = (await res.json()) as {
    response?: {
      players?: Array<{
        personaname: string;
        avatarfull: string;
        communityvisibilitystate: number;
      }>;
    };
  };
  const p = json.response?.players?.[0];
  if (!p) {
    throw new ProfileNotFoundError(
      'Bu SteamID64 ile eşleşen bir profil bulunamadı.',
    );
  }
  return {
    personaName: p.personaname,
    avatar: p.avatarfull,
    visibility: p.communityvisibilitystate,
  };
}
