import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { assertProductionEnvironment, databasePath, initialLicenseKey } from "./env";
import { hashLicenseKey, normalizeLicenseKey } from "./crypto";

declare global {
  // eslint-disable-next-line no-var
  var __hookmergeDb: DatabaseSync | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  expires_at INTEGER,
  last_seen_at INTEGER,
  generation_limit INTEGER,
  generations_used INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_license ON sessions(license_id);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_configs (
  license_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_enc TEXT,
  key_mode TEXT NOT NULL DEFAULT 'stored',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  body TEXT NOT NULL,
  structure TEXT,
  analysis TEXT,
  niche TEXT NOT NULL,
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  reference_title TEXT,
  reference_source TEXT,
  generation_ms INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scripts_license ON scripts(license_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  error_hint TEXT,
  payload TEXT,
  transcript TEXT,
  analysis TEXT,
  script_id TEXT,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_license ON jobs(license_id, created_at DESC);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_license ON files(license_id);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function seed(db: DatabaseSync) {
  const defaults: Record<string, string> = {
    license_generation_limit_default: "0",
    license_validity_days_default: "0",
    max_upload_mb: String(Math.round(Number(process.env.MAX_UPLOAD_MB || 200))),
  };
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(defaults)) insert.run(key, value);

  const initial = initialLicenseKey();
  if (initial && normalizeLicenseKey(initial).length >= 6) {
    const now = Date.now();
    const existing = db
      .prepare("SELECT id FROM licenses WHERE key_hash = ?")
      .get(hashLicenseKey(initial)) as { id: string } | undefined;
    if (!existing) {
      db.prepare(
        `INSERT INTO licenses (id, key_hash, key_prefix, label, status, created_at, generation_limit, generations_used, notes)
         VALUES (?, ?, ?, ?, 'active', ?, NULL, 0, ?)`,
      ).run(
        `lic_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        hashLicenseKey(initial),
        normalizeLicenseKey(initial).slice(0, 6),
        "Initial license",
        now,
        "Seeded from INITIAL_LICENSE_KEY",
      );
    }
  }
}

export function getDb(): DatabaseSync {
  assertProductionEnvironment();
  if (globalThis.__hookmergeDb) return globalThis.__hookmergeDb;
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  seed(db);
  globalThis.__hookmergeDb = db;
  return db;
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
