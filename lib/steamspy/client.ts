import { fetchWithTimeout } from '@/lib/http/fetch';
import { STEAMSPY_TIMEOUT_MS } from '@/lib/http/constants';

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
  const res = await fetchWithTimeout(
    fetchImpl, `${BASE}?request=appdetails&appid=${appid}`, STEAMSPY_TIMEOUT_MS,
  );
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
