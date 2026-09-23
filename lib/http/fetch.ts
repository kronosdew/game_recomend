import { UpstreamTimeoutError } from '@/lib/steam/types';

/**
 * `fetch` üzerine ince bir sarmalayıcı: her isteğe bir üst süre sınırı
 * koyar ve zaman aşımını hata taksonomisine bağlar.
 *
 * Zaman aşımı SESSİZCE YUTULMAZ ve genel bir 500'e dönüştürülmez:
 * `AbortSignal.timeout` tarafından üretilen `TimeoutError`/`AbortError`
 * `UpstreamTimeoutError`'a çevrilir; route bunu 504 `upstream_timeout`
 * olarak eşler ve kullanıcı "kaynak şu an yanıt vermiyor, tekrar deneyin"
 * mesajını görür. Böylece geçici bir yavaşlık, kalıcı bir sunucu hatası
 * gibi raporlanmaz.
 *
 * Not: test sahteleri (`fetchImpl`) ikinci argümanı yok sayabilir; sarmalayıcı
 * yalnızca gerçek `fetch` davranışını etkiler.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (isTimeout(e)) {
      throw new UpstreamTimeoutError(
        `Dış servis ${timeoutMs} ms içinde yanıt vermedi.`,
      );
    }
    throw e;
  }
}

function isTimeout(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const name = (e as { name?: unknown }).name;
  return name === 'TimeoutError' || name === 'AbortError';
}
