import { NextResponse } from 'next/server';
import { openDb, getCandidatePool } from '@/lib/catalog/db';
import { loadOwnedGamesMeta } from '@/lib/catalog/owned-games-meta';
import { getOwnedGames } from '@/lib/steam/client';
import { resolveToSteamId64 } from '@/lib/steam/profile-url';
import { recommend } from '@/lib/recommend/pipeline';
import {
  PrivateProfileError, VanityNotFoundError, InvalidProfileUrlError,
} from '@/lib/steam/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 500 });
  }

  let body: { profile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  if (!body.profile) {
    return NextResponse.json({ error: 'Profil adresi gerekli.' }, { status: 400 });
  }

  try {
    const steamId = await resolveToSteamId64(body.profile, apiKey);
    const games = await getOwnedGames(steamId, apiKey);

    // R4: en çok oynanan (en fazla OWNED_GAMES_META_CAP) oyunun meta verisi
    // önce katalog önbelleğinden, yalnızca eksikler için SteamSpy'dan
    // (istekler arası boşluk bırakılarak) yüklenir. Bkz. lib/catalog/owned-games-meta.ts.
    const db = openDb();
    const metaById = await loadOwnedGamesMeta(db, games);

    const pool = getCandidatePool(db, new Date());
    const results = recommend({ games, metaById, pool, now: new Date() });

    // Katman 0: hiçbir kişisel veri kaydedilmez. Yanıt üretilir ve unutulur;
    // yalnızca yazılan şey (loadOwnedGamesMeta içinde) kamuya açık katalogdur.
    return NextResponse.json({
      count: results.length,
      recommendations: results.map((r) => ({
        appid: r.meta.appid,
        name: r.meta.name,
        score: Number(r.score.toFixed(4)),
        releaseDate: r.meta.releaseDate,
        reason: r.explanation.text,
        tags: r.explanation.topTags,
      })),
    });
  } catch (e) {
    if (e instanceof PrivateProfileError) {
      return NextResponse.json({ error: 'private_profile' }, { status: 409 });
    }
    if (e instanceof VanityNotFoundError) {
      return NextResponse.json({ error: 'vanity_not_found' }, { status: 404 });
    }
    if (e instanceof InvalidProfileUrlError) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
