import type { TagVector } from '@/lib/steam/types';

export function l2Normalize(v: TagVector): TagVector {
  let sum = 0;
  for (const x of v.values()) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return new Map();
  const out: TagVector = new Map();
  for (const [k, x] of v) out.set(k, x / norm);
  return out;
}

export function cosine(a: TagVector, b: TagVector): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w !== undefined) dot += v * w;
  }
  // Her iki vektör de L2 normalize olduğu için nokta çarpımı doğrudan kosinüstür.
  return dot;
}
