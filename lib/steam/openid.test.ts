import { describe, it, expect, vi } from 'vitest';
import { buildLoginUrl, verifyCallback } from './openid';
import { OpenIdVerificationError } from './types';

const CLAIMED = 'https://steamcommunity.com/openid/id/76561198012345678';

function callbackParams(claimed = CLAIMED) {
  return new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.claimed_id': claimed,
    'openid.identity': claimed,
    'openid.sig': 'abc',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity',
  });
}

const okFetch = () =>
  vi.fn().mockResolvedValue({ text: async () => 'ns:...\nis_valid:true\n' });

describe('buildLoginUrl', () => {
  it('identifier_select ile Steam login URL kurar', () => {
    const url = new URL(buildLoginUrl('http://x/cb', 'http://x'));
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login');
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.return_to')).toBe('http://x/cb');
    expect(url.searchParams.get('openid.identity'))
      .toBe('http://specs.openid.net/auth/2.0/identifier_select');
  });
});

describe('verifyCallback', () => {
  it('geçerli yanıtta SteamID64 döner', async () => {
    const f = okFetch();
    await expect(verifyCallback(callbackParams(), f as never))
      .resolves.toBe('76561198012345678');
  });

  it('Steam mode=check_authentication ile POST edilir', async () => {
    const f = okFetch();
    await verifyCallback(callbackParams(), f as never);
    const body = f.mock.calls[0][1].body as URLSearchParams;
    expect(f.mock.calls[0][1].method).toBe('POST');
    expect(body.get('openid.mode')).toBe('check_authentication');
  });

  it('is_valid:false ise reddeder', async () => {
    const f = vi.fn().mockResolvedValue({ text: async () => 'is_valid:false\n' });
    await expect(verifyCallback(callbackParams(), f as never))
      .rejects.toBeInstanceOf(OpenIdVerificationError);
  });

  it('is_valid:true olsa bile yabancı claimed_id reddedilir', async () => {
    const f = okFetch();
    await expect(
      verifyCallback(callbackParams('https://evil.example/openid/id/76561198012345678'), f as never)
    ).rejects.toBeInstanceOf(OpenIdVerificationError);
  });

  it('SteamID64 biçimi tutmuyorsa reddedilir', async () => {
    const f = okFetch();
    await expect(
      verifyCallback(callbackParams('https://steamcommunity.com/openid/id/123'), f as never)
    ).rejects.toBeInstanceOf(OpenIdVerificationError);
  });
});
