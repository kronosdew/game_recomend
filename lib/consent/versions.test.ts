import { describe, it, expect } from 'vitest';
import {
  isConsentValid,
  CONSENT_TEXT_VERSION,
  PRIVACY_NOTICE_VERSION,
  ConsentLayer,
} from './versions';

describe('isConsentValid', () => {
  it('güncel versiyonlu onayı geçerli sayar', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(true);
  });

  it('eski versiyonlu onayı GEÇERSİZ sayar — kullanıcı o metni hiç görmedi', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: true, textVersion: CONSENT_TEXT_VERSION - 1 },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('gelecekteki bir versiyonlu onayı da GEÇERSİZ sayar — >= ile === karıştırılmamalı', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: true, textVersion: CONSENT_TEXT_VERSION + 1 },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('reddedilmiş onayı geçersiz sayar', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Storage, granted: false, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('başka katmanın onayı bu katmanı kapsamaz', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Email, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('reddedilmiş VE başka katmana ait bir kaydı da geçersiz sayar', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Analytics, granted: false, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Storage,
    )).toBe(false);
  });

  it('her katman kendi sorgusunda geçerli sayılabilir (Email)', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Email, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Email,
    )).toBe(true);
  });

  it('her katman kendi sorgusunda geçerli sayılabilir (Analytics)', () => {
    expect(isConsentValid(
      { layer: ConsentLayer.Analytics, granted: true, textVersion: CONSENT_TEXT_VERSION },
      ConsentLayer.Analytics,
    )).toBe(true);
  });
});

describe('PRIVACY_NOTICE_VERSION ve CONSENT_TEXT_VERSION', () => {
  it('her ikisi de bağımsız birer sayı sabitidir', () => {
    // Not: ikisi şu an aynı değere (1) sahip olduğu için bu test, biri diğeri
    // cinsinden tanımlansa bile (örn. `export const CONSENT_TEXT_VERSION =
    // PRIVACY_NOTICE_VERSION`) BAŞARISIZ OLMAZ — bu bir çalışma zamanı
    // davranışı değil, kaynak koddaki bir tanım ilişkisidir ve testle
    // pinlenemez. Bağımsızlık, versions.ts'teki doc yorumuyla ve kod
    // incelemesiyle korunur: aydınlatma metni ile açık rıza metni KVKK'da
    // ayrı belgelerdir, bu yüzden versiyonları asla birbirine bağlanmamalıdır.
    expect(typeof PRIVACY_NOTICE_VERSION).toBe('number');
    expect(typeof CONSENT_TEXT_VERSION).toBe('number');
  });
});

describe('ConsentLayer', () => {
  it('dört katmanı da içerir: Ephemeral, Storage, Email, Analytics', () => {
    expect(ConsentLayer.Ephemeral).toBeDefined();
    expect(ConsentLayer.Storage).toBeDefined();
    expect(ConsentLayer.Email).toBeDefined();
    expect(ConsentLayer.Analytics).toBeDefined();
  });
});
