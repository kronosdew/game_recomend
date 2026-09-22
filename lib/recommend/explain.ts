import type { GameMeta, OwnedGame, TagVector } from '@/lib/steam/types';
import type { Candidate } from './scoring';
import { MIN_PLAYTIME_MINUTES } from './constants';

export interface Explanation {
  topTags: string[];
  drivingGames: Array<{ name: string; hours: number }>;
  text: string;
}

export function explainRecommendation(
  user: TagVector,
  candidate: Candidate,
  games: OwnedGame[],
  metaById: Map<number, GameMeta>,
): Explanation {
  // Skora en çok katkı veren etiketler: kullanıcı ve aday ağırlığının çarpımı.
  // Yalnızca kullanıcının pozitif ağırlık verdiği etiketler dikkate alınır —
  // negatif ağırlık "hoşlanmama" sinyalidir ve asla bir önerinin gerekçesi olamaz.
  const contributions: Array<[string, number]> = [];
  for (const [tag, cw] of candidate.vector) {
    const uw = user.get(tag);
    if (uw !== undefined && uw > 0) contributions.push([tag, uw * cw]);
  }
  contributions.sort((a, b) => b[1] - a[1]);
  const topTags = contributions.slice(0, 3).map(([t]) => t);

  // O etiketleri taşıyan, yeterince oynanmış (>= MIN_PLAYTIME_MINUTES), en çok
  // oynanmış oyunlar — süresi yetersiz oyunlar Task 6'da zaten zevk kanıtı
  // sayılmadığından burada da gerekçe olarak gösterilmez.
  const tagSet = new Set(topTags);
  const driving = games
    .filter((g) => {
      if (g.playtime_forever < MIN_PLAYTIME_MINUTES) return false;
      const m = metaById.get(g.appid);
      if (!m) return false;
      for (const t of m.tags.keys()) if (tagSet.has(t)) return true;
      return false;
    })
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 2)
    .map((g) => ({ name: g.name, hours: Math.round(g.playtime_forever / 60) }));

  // Üç durum: (1) hem etiket hem kanıt oyun var — tam cümle; (2) etiket var
  // ama kanıt oyun yok (ör. metaById kaynağı games'i tam kapsamıyor) — oyun
  // adı/oynama süresi iddia etmeyen, yalnızca etiketi anan bir cümle; (3) hiç
  // ortak etiket yok — genel geri dönüş. (2), topTags'in text ile tutarsız
  // kalmaması için var: topTags kullanıcıya gösterilirken text'in "genel
  // eğilim" demesi, aynı yanıtta çelişkili bilgi vermek olurdu.
  const text =
    topTags.length === 0
      ? 'Kütüphanenizdeki genel eğilime göre seçildi.'
      : driving.length > 0
        ? `${driving.map((g) => `${g.name} (${g.hours} saat)`).join(' ve ')} ` +
          `oynadınız — ${topTags.join(', ')} ağırlığınız yüksek.`
        : `${topTags.join(', ')} ağırlığınız yüksek olduğu için önerildi.`;

  return { topTags, drivingGames: driving, text };
}
