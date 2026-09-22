import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, upsertGameMeta, getCandidatePool, getGameMetaByIds } from './db';
import type { GameMeta } from '@/lib/steam/types';

const NOW = new Date('2026-09-22T00:00:00Z');

function meta(over: Partial<GameMeta> = {}): GameMeta {
  return {
    appid: 1, name: 'G', tags: new Map([['A', 1], ['B', 0.5]]), genres: ['Action'],
    releaseDate: '2026-09-01', reviewCount: 100, positiveRatio: 0.9,
    owners: 10_000, ...over,
  };
}

describe('katalog db', () => {
  it('yazıp geri okur, etiket Map’i korunur', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta());
    const pool = getCandidatePool(db, NOW);
    expect(pool).toHaveLength(1);
    expect(pool[0].meta.tags.get('A')).toBeCloseTo(1);
    expect(pool[0].meta.tags.get('B')).toBeCloseTo(0.5);
  });

  it('aynı appid tekrar yazılınca çoğalmaz, günceller', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ name: 'Eski' }));
    upsertGameMeta(db, meta({ name: 'Yeni' }));
    const pool = getCandidatePool(db, NOW);
    expect(pool).toHaveLength(1);
    expect(pool[0].meta.name).toBe('Yeni');
    // Havuz filtrelemesi yanıltmasın diye ham satır sayısını da doğrudan kontrol et.
    const row = db.prepare('SELECT COUNT(*) as c FROM game_meta').get() as { c: number };
    expect(row.c).toBe(1);
  });

  it('kalite kapısını geçmeyeni havuza koymaz', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 2, reviewCount: 10 }));
    expect(getCandidatePool(db, NOW)).toHaveLength(0);
  });

  it('90 günden eskiyi havuza koymaz', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 3, releaseDate: '2025-01-01' }));
    expect(getCandidatePool(db, NOW)).toHaveLength(0);
  });

  it('havuzdaki her adayın normalize vektörü vardır', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta());
    const norm = Math.sqrt(
      [...getCandidatePool(db, NOW)[0].vector.values()].reduce((s, x) => s + x * x, 0),
    );
    expect(norm).toBeCloseTo(1);
  });

  it('etiket JSON round-trip: değerleri de korur, yalnızca anahtarları değil', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ tags: new Map([['A', 0.2], ['B', 0.77], ['C', 1]]) }));
    const pool = getCandidatePool(db, NOW);
    expect(pool[0].meta.tags.size).toBe(3);
    expect(pool[0].meta.tags.get('A')).toBeCloseTo(0.2);
    expect(pool[0].meta.tags.get('B')).toBeCloseTo(0.77);
    expect(pool[0].meta.tags.get('C')).toBeCloseTo(1);
  });

  it('etiketi olmayan oyun havuza girmez (skorlanamaz)', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta({ appid: 4, tags: new Map() }));
    expect(getCandidatePool(db, NOW)).toHaveLength(0);
  });

  it('getGameMetaByIds: boş dizi boş Map döner, sorgu patlamaz', () => {
    const db = openDb(':memory:');
    upsertGameMeta(db, meta());
    const result = getGameMetaByIds(db, []);
    expect(result.size).toBe(0);
  });

  it('getGameMetaByIds: bulunanları döner, kalite kapısı ve tarih penceresi uygulanmaz', () => {
    const db = openDb(':memory:');
    // Kalite kapısını geçemeyen ve çok eski bir oyun — getCandidatePool bunu reddeder
    // ama getGameMetaByIds kullanıcının kendi kütüphanesindeki eski oyunları da döndürmeli.
    upsertGameMeta(db, meta({ appid: 5, reviewCount: 1, releaseDate: '2010-01-01' }));
    const result = getGameMetaByIds(db, [5, 999]);
    expect(result.size).toBe(1);
    expect(result.get(5)?.appid).toBe(5);
    expect(result.has(999)).toBe(false);
    expect(result.get(5)?.tags.get('A')).toBeCloseTo(1);
  });

  it('getGameMetaByIds: önbellekte olmayan appid sessizce atlanır', () => {
    const db = openDb(':memory:');
    const result = getGameMetaByIds(db, [12345]);
    expect(result.size).toBe(0);
  });

  it('getGameMetaByIds: 500\'lük sorgu grubu sınırını aşan istek hepsini döner', () => {
    const db = openDb(':memory:');
    const COUNT = 501; // tek bir SQL grubunun (QUERY_CHUNK_SIZE) sınırını aşar
    for (let i = 1; i <= COUNT; i++) {
      upsertGameMeta(db, meta({ appid: i, name: `Game ${i}`, tags: new Map([[`T${i}`, 1]]) }));
    }
    const ids = Array.from({ length: COUNT }, (_, i) => i + 1);
    const result = getGameMetaByIds(db, ids);
    expect(result.size).toBe(COUNT);
    for (const id of ids) {
      expect(result.get(id)?.appid).toBe(id);
      expect(result.get(id)?.name).toBe(`Game ${id}`);
    }
  });
});

describe('openDb — eksik dizin oluşturma (R3)', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-db-test-'));

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it('var olmayan üst dizini yaratıp veritabanını açar', () => {
    const dbPath = path.join(tmpBase, 'nested', 'dir', 'catalog.db');
    expect(fs.existsSync(path.dirname(dbPath))).toBe(false);
    const db = openDb(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
    upsertGameMeta(db, meta());
    expect(getCandidatePool(db, NOW)).toHaveLength(1);
    db.close();
  });

  it("':memory:' için mkdir hiç çağrılmaz", () => {
    // path.dirname(':memory:') zaten var olan bir dizine (".") çözülür, bu yüzden
    // yalnızca "çökmedi" testi mkdir'in yanlışlıkla çağrıldığını yakalayamaz —
    // doğrudan çağrıyı gözlemlememiz gerekir.
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    try {
      openDb(':memory:');
      expect(mkdirSpy).not.toHaveBeenCalled();
    } finally {
      mkdirSpy.mockRestore();
    }
  });
});
