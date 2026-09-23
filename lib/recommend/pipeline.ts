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
 * Saf boru hattı: vektör → skor → eleme → normalize → çeşitlendirme → gerekçe.
 * G/Ç yok — çağıran (API route / sayfa) veriyi toplayıp buraya taşır. `now`
 * parametre olarak alınır, kontrolsüz sistem saati kullanılmaz.
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

  // --- R25: alaka tabanı ---------------------------------------------------
  // MMR koşulsuz olarak k=20'ye kadar doldurur; skor tabanı olmadığı için
  // zayıf sinyalli bir kullanıcıya, hiçbiri zevkiyle örtüşmeyen (hatta
  // NEGATİF skorlu) 20 "öneri" üretiyordu — üstelik hepsi aynı, hiçbir şey
  // açıklamayan gerekçe cümlesiyle. Skoru <= 0 olan aday, kullanıcının
  // zevkiyle ya hiç kesişmiyor (0) ya da ters düşüyor (< 0, negatif sinyal);
  // ikisi de öneri değildir. Liste 20'den kısa olabilir ve boş dönebilir —
  // "sana uyan bir şey bulamadık" dürüst bir yanıttır, 20 rastgele oyun
  // değildir.
  const relevant = scored.filter((s) => s.score > 0);
  if (relevant.length === 0) return [];

  // --- R24: MMR girdisinin ölçek uyumu -------------------------------------
  // Spec §6.3 skoru popülerlik sönümlemesiyle (log1p(sahipSayısı)) böler;
  // bu, gerçekçi sahip sayılarında skoru ~[0, 0.12] aralığına sıkıştırır.
  // Spec §6.4'ün MMR formülü ise aynı λ altında bu skoru HAM KOSİNÜSLE
  // ([0, 1]) birleştirir. İki aralık uyumsuz: λ*skor tavanı ~0.085 iken
  // (1-λ)*maxSim cezası 0.27'ye kadar çıkar — ceza, erişilebilir alaka
  // tavanının ~3.2 katı. Sonuç: MMR alakayı değil ALAKASIZLIĞI optimize
  // eder; ilk sıra doğru kalır (seçilenler boş, ceza yok), 2-20 gürültü olur.
  // Bu yüzden MMR'a skorlar [0,1]'e normalize edilerek verilir.
  //
  // Normalize skor YALNIZCA sıralama içindir ve dışarı sızmaz: aşağıda
  // sıralanan nesneler orijinallerine geri eşlenir, böylece API yanıtındaki
  // `score` alanı §6.3'ün skoru olarak kalır.
  let max = 0;
  for (const s of relevant) if (s.score > max) max = s.score;

  const originalOf = new Map<Scored, Scored>();
  const normalized = relevant.map((s) => {
    const n: Scored = { ...s, score: s.score / max };
    originalOf.set(n, s);
    return n;
  });

  const diversified = mmrRerank(normalized).map((n) => originalOf.get(n) ?? n);

  return diversified.map((s) => ({
    ...s,
    explanation: explainRecommendation(user, s, games, metaById),
  }));
}
