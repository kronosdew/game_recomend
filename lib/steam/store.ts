import { fetchWithTimeout } from '@/lib/http/fetch';
import { STEAM_STORE_TIMEOUT_MS, STEAM_SEARCH_TIMEOUT_MS } from '@/lib/http/constants';

/**
 * Hem kısaltma hem tam ad kabul edilir ("12 Sep, 2026" ve "12 September, 2026"
 * ikisi de Steam'de görülür). Eskiden ay parçası `([A-Za-z]{3})[a-z]*` ile
 * eşleşiyordu; bu, ilk üç harfi tutan HER şeyi ("Janx", "Septemberrr") geçerli
 * sayıyordu. Tam sözlük eşleşmesi bu boşluğu kapatır.
 */
const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Steam'in tarih biçimini ISO `yyyy-mm-dd`'ye çevirir; tanımadığı her şeye
 * `null` der.
 *
 * Kalıp BAŞTAN SONA ÇIPALIDIR (`^...$`): gömülü bir tarih taşıyan serbest
 * metin ("Erken erişim: 12 Sep, 2026 civarı") kabul edilmez. Ayrıca sonuç
 * gerçekten var olan bir takvim günü olmalıdır — "31 Feb, 2026" sözdizimi
 * olarak doğrudur ama bir tarih değildir ve kalite kapısında sessizce
 * NaN'a dönüşürdü.
 */
export function parseReleaseDate(input: string | undefined): string | null {
  if (!input) return null;
  const m = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;

  const iso = `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
  // Takvimde var olmayan gün (ör. 31 Şubat) JS'te bir sonraki aya taşar;
  // geri yazıp karşılaştırmak bunu yakalar.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export async function fetchStoreDetails(
  appid: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ name: string; genres: string[]; releaseDate: string; type: string } | null> {
  const res = await fetchWithTimeout(
    fetchImpl,
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=turkish`,
    STEAM_STORE_TIMEOUT_MS,
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
    const res = await fetchWithTimeout(
      fetchImpl,
      `https://store.steampowered.com/search/results/?query&start=${page * 50}` +
      `&count=50&sort_by=Released_DESC&category1=998&json=1`,
      STEAM_SEARCH_TIMEOUT_MS,
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
