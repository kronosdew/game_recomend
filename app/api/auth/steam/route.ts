import { NextResponse } from 'next/server';
import { buildLoginUrl } from '@/lib/steam/openid';

export const runtime = 'nodejs';

export async function GET() {
  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    return NextResponse.json({ error: 'APP_ORIGIN tanımlı değil.' }, { status: 500 });
  }
  return NextResponse.redirect(
    buildLoginUrl(`${origin}/api/auth/steam/callback`, origin),
  );
}
