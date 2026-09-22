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
