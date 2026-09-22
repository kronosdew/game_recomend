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
    if (c.vector.size === 0) continue; // etiketsiz aday skorlanamaz

    const base = cosine(user, c.vector);
    const days = daysSince(c.meta.releaseDate, now);
    const recency = 1 + 0.2 * Math.max(0, 1 - days / RELEASE_WINDOW_DAYS);
    const damp = Math.log1p(Math.max(c.meta.owners, 1)) || 1;

    const score = (base * recency) / damp;
    if (!Number.isFinite(score)) continue; // bozuk aritmetik sıralamayı bozmasın
    out.push({ ...c, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
