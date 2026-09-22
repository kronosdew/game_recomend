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

    // Terk edilmiş oyun kontrolü, 60 dakikalık eşikten ÖNCE çalışmalı;
    // aksi halde bu oyunlar atlanır ve negatif sinyalleri hiç katkı vermez.
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
