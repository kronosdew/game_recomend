import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { GameMeta } from '@/lib/steam/types';
import type { Candidate } from '@/lib/recommend/scoring';
import { passesQualityGate } from '@/lib/recommend/scoring';
import { l2Normalize } from '@/lib/recommend/vector';

export type Db = Database.Database;

// Bu tablo KAMUYA AÇIK oyun katalogudur, kişisel veri içermez.
// Katman 0 (stateless) modunda bile mevcuttur.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_meta (
  appid          INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  tags_json      TEXT NOT NULL,
  genres_json    TEXT NOT NULL,
  release_date   TEXT NOT NULL,
  review_count   INTEGER NOT NULL,
  positive_ratio REAL NOT NULL,
  owners         INTEGER NOT NULL,
  fetched_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_release ON game_meta(release_date);
`;

export const DEFAULT_DB_PATH = 'data/catalog.db';

/**
 * Dosya tabanlı bağlantılar için modül düzeyinde havuz.
 *
 * Neden: `openDb` her istekte yeni bir `better-sqlite3` bağlantısı açıyordu
 * ve hiçbir yerde kapatılmıyordu — her öneri isteği bir dosya tanıtıcısı
 * sızdırıyordu. SQLite eşzamanlı okuyucuları zaten tek bağlantı üzerinden
 * güvenle karşılar; süreç ömrü boyunca tek bağlantı doğru modeldir.
 *
 * ':memory:' BİLEREK havuzlanmaz: bellek içi veritabanı bağlantıya özeldir
 * ve testler her çağrıdan İZOLE bir veritabanı bekler. Havuzlansaydı
 * testler birbirinin satırlarını görürdü.
 */
const pool = new Map<string, Db>();

export function openDb(dbPath = DEFAULT_DB_PATH): Db {
  const shared = dbPath !== ':memory:';
  if (shared) {
    const cached = pool.get(dbPath);
    // `db.open`, dışarıdan kapatılmış bir bağlantıyı yeniden açmamızı sağlar
    // (ör. kendi bağlantısını kapatan bir test).
    if (cached?.open) return cached;
    // ':memory:' bir dosya sistemi yolu değildir — dizin oluşturma denemesi yapılmaz.
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  if (shared) pool.set(dbPath, db);
  return db;
}

export function upsertGameMeta(db: Db, m: GameMeta): void {
  db.prepare(`
    INSERT INTO game_meta
      (appid, name, tags_json, genres_json, release_date,
       review_count, positive_ratio, owners, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(appid) DO UPDATE SET
      name=excluded.name, tags_json=excluded.tags_json,
      genres_json=excluded.genres_json, release_date=excluded.release_date,
      review_count=excluded.review_count, positive_ratio=excluded.positive_ratio,
      owners=excluded.owners, fetched_at=excluded.fetched_at
  `).run(
    m.appid, m.name,
    JSON.stringify(Object.fromEntries(m.tags)),
    JSON.stringify(m.genres),
    m.releaseDate, m.reviewCount, m.positiveRatio, m.owners,
    Math.floor(Date.now() / 1000),
  );
}

interface Row {
  appid: number; name: string; tags_json: string; genres_json: string;
  release_date: string; review_count: number; positive_ratio: number; owners: number;
}

function rowToMeta(r: Row): GameMeta {
  return {
    appid: r.appid,
    name: r.name,
    tags: new Map(Object.entries(JSON.parse(r.tags_json) as Record<string, number>)),
    genres: JSON.parse(r.genres_json) as string[],
    releaseDate: r.release_date,
    reviewCount: r.review_count,
    positiveRatio: r.positive_ratio,
    owners: r.owners,
  };
}

export function getCandidatePool(db: Db, now: Date): Candidate[] {
  const rows = db.prepare('SELECT * FROM game_meta').all() as Row[];
  const out: Candidate[] = [];
  for (const r of rows) {
    const meta = rowToMeta(r);
    if (!passesQualityGate(meta, now)) continue;
    if (meta.tags.size === 0) continue;
    out.push({ meta, vector: l2Normalize(meta.tags) });
  }
  return out;
}

// SQLite'ın tek sorgudaki değişken sayısı sınırına (SQLITE_MAX_VARIABLE_NUMBER)
// takılmamak için büyük appid listelerini gruplar halinde sorgular.
const QUERY_CHUNK_SIZE = 500;

/**
 * Verilen appid'ler için önbellekteki meta verileri döner. Yalnızca önbellekte
 * bulunanlar döner (bulunamayanlar sessizce atlanır — çağıran karar verir).
 * Kalite kapısı ve yayın tarihi penceresi burada UYGULANMAZ: bu fonksiyon
 * kullanıcının zaten sahip olduğu (çoğunlukla eski) oyunları aramak içindir,
 * aday havuzu için değil.
 */
export function getGameMetaByIds(db: Db, appids: number[]): Map<number, GameMeta> {
  const out = new Map<number, GameMeta>();
  const unique = [...new Set(appids)];
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += QUERY_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + QUERY_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM game_meta WHERE appid IN (${placeholders})`)
      .all(...chunk) as Row[];
    for (const r of rows) out.set(r.appid, rowToMeta(r));
  }
  return out;
}
