'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseProfileUrl } from '@/lib/steam/profile-url';
import { DEMO_PROFILE_COOKIE, DEMO_PROFILE_MAX_AGE_SECONDS } from '@/lib/cookies';

/**
 * Anasayfadaki "profil linkini yapıştır" formunun hedefi (I8).
 *
 * Form eskiden `method="get"` ile `/oneriler?profile=<link>` adresine
 * gidiyordu; profil adresi böylece sunucu erişim kaydına, tarayıcı geçmişine
 * ve `Referer` başlığına düşüyordu. Server Action'lar POST üzerinden çalışır,
 * bu yüzden değer artık istek gövdesinde taşınır ve hiçbir URL'ye yazılmaz.
 *
 * Adres burada da doğrulanır: geçersiz bir girdiyle çerez kurup kullanıcıyı
 * boşuna /oneriler'e göndermeyiz.
 */
export async function oneriIste(formData: FormData): Promise<void> {
  const profile = String(formData.get('profile') ?? '').trim();

  let gecerli = true;
  try {
    parseProfileUrl(profile);
  } catch {
    gecerli = false;
  }
  // `redirect` bir kontrol akışı istisnası fırlatır; try/catch DIŞINDA çağrılır.
  if (!gecerli) redirect('/?hata=adres');

  const jar = await cookies();
  jar.set(DEMO_PROFILE_COOKIE, profile, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_PROFILE_MAX_AGE_SECONDS,
  });

  redirect('/oneriler');
}
