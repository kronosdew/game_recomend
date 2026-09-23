import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { produceRecommendations, recommendErrorCode } from '@/lib/server/recommendations';
import { logError } from '@/lib/log';
import { STEAM_ID_COOKIE } from '@/lib/cookies';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { profile?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // R27 (I6'nın ucuz kısmı): doğrulanmış bir oturum çerezi varsa gövdedeki
  // `profile` alanı YOK SAYILIR. Girişli kullanıcı adına başka bir profilin
  // sorgulanmasının bir anlamı yok; sahipliği kanıtlanmış kimlik önceliklidir.
  // (Kimliksiz/limitsiz erişimin geri kalanı — hız sınırlama — bu turun
  // kapsamı dışında bırakıldı: altyapı kararı gerektiriyor.)
  const steamId = (await cookies()).get(STEAM_ID_COOKIE)?.value;
  const profile = steamId ?? body.profile;

  if (!profile) {
    return NextResponse.json({ error: 'Profil adresi gerekli.' }, { status: 400 });
  }

  try {
    // Katman 0: hiçbir kişisel veri kaydedilmez. Yanıt üretilir ve unutulur.
    return NextResponse.json(await produceRecommendations(profile));
  } catch (e) {
    const { code, status } = recommendErrorCode(e);
    // Beklenen taksonomi dışı hatalar sessizce yutulmaz (I10). Kayda yalnızca
    // hata türü düşer; profil adresi, SteamID64 ve API anahtarı ASLA.
    if (code === 'unknown' || code === 'config_missing') {
      logError('api.recommend', e, { code });
    }
    return NextResponse.json({ error: code }, { status });
  }
}
