import { NextResponse } from 'next/server';
import { verifyCallback } from '@/lib/steam/openid';
import { OpenIdVerificationError } from '@/lib/steam/types';

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
    res.cookies.set('steam_id', steamId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    if (e instanceof OpenIdVerificationError) {
      return NextResponse.redirect(`${origin}/?hata=giris`);
    }
    return NextResponse.redirect(`${origin}/?hata=bilinmeyen`);
  }
}
