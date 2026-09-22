import type { GameMeta, OwnedGame } from '@/lib/steam/types';
import type { Candidate, Scored } from './scoring';
import { scoreCandidates } from './scoring';
import { buildUserVector } from './user-vector';
import { mmrRerank } from './mmr';
import { explainRecommendation, type Explanation } from './explain';

export interface Recommendation extends Scored {
  explanation: Explanation;
}

/**
 * Saf boru hattı: vektör → skor → çeşitlendirme → gerekçe. G/Ç yok — çağıran
 * (API route) veriyi toplayıp buraya taşır. `now` parametre olarak alınır,
 * kontrolsüz sistem saati kullanılmaz.
 */
export function recommend(input: {
  games: OwnedGame[];
  metaById: Map<number, GameMeta>;
  pool: Candidate[];
  now: Date;
}): Recommendation[] {
  const { games, metaById, pool, now } = input;

  const user = buildUserVector(games, metaById, now.getTime() / 1000);
  if (user.size === 0) return []; // zevk çıkarılamadı, tahmin uydurma

  const owned = new Set(games.map((g) => g.appid));
  const scored = scoreCandidates(user, pool, owned, now);
  const diversified = mmrRerank(scored);

  return diversified.map((s) => ({
    ...s,
    explanation: explainRecommendation(user, s, games, metaById),
  }));
}
