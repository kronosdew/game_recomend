import { NextResponse } from 'next/server';
import { verifyCallback } from '@/lib/steam/openid';
import { OpenIdVerificationError } from '@/lib/steam/types';
import { logError } from '@/lib/log';
import { STEAM_ID_COOKIE, STEAM_ID_MAX_AGE_SECONDS } from '@/lib/cookies';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    return NextResponse.json({ error: 'APP_ORIGIN tanımlı değil.' }, { status: 500 });
  }
  const params = new URL(req.url).searchParams;

  try {
    // Gelen parametrelere DOĞRUDAN güvenilmez; Steam'e geri doğrulatılır.
    const steamId = await verifyCallback(params);
    const res = NextResponse.redirect(`${origin}/oneriler`);
    res.cookies.set(STEAM_ID_COOKIE, steamId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STEAM_ID_MAX_AGE_SECONDS,
    });
    return res;
  } catch (e) {
    if (e instanceof OpenIdVerificationError) {
      // Beklenen akış (kullanıcı girişi iptal etti, imza uyuşmadı vb.):
      // gürültü yapmadan anasayfaya döndürülür.
      return NextResponse.redirect(`${origin}/?hata=giris`);
    }
    // Beklenmeyen hata sessizce yutulmaz (I10). Kayda yalnızca hata türü
    // düşer; openid parametreleri ve SteamID64 ASLA.
    logError('api.auth.steam.callback', e);
    return NextResponse.redirect(`${origin}/?hata=bilinmeyen`);
  }
}
