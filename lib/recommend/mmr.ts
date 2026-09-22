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
