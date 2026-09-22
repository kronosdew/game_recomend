import { OpenIdVerificationError } from './types';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID_RE =
  /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

export function buildLoginUrl(returnTo: string, realm: string): string {
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID}?${p.toString()}`;
}

export async function verifyCallback(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams(params);
  body.set('openid.mode', 'check_authentication');

  const res = await fetchImpl(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();

  if (!/^is_valid:true\s*$/m.test(text)) {
    throw new OpenIdVerificationError('Steam doğrulaması başarısız.');
  }

  const match = CLAIMED_ID_RE.exec(params.get('openid.claimed_id') ?? '');
  if (!match) {
    throw new OpenIdVerificationError('Geçersiz claimed_id.');
  }
  return match[1];
}
