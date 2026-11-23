import { getDb } from "./db";
import {
  generateLicenseKey,
  hashLicenseKey,
  normalizeLicenseKey,
} from "./crypto";
import type { LicenseView } from "./types";

export type LicenseRow = {
  id: string;
  key_hash: string;
  key_prefix: string;
  label: string | null;
  status: "active" | "revoked";
  created_at: number;
  activated_at: number | null;
  expires_at: number | null;
  last_seen_at: number | null;
  generation_limit: number | null;
  generations_used: number;
  notes: string | null;
};

export function licenseToView(row: LicenseRow): LicenseView {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.key_prefix,
    status: row.status,
    generationLimit: row.generation_limit,
    generationsUsed: row.generations_used,
    expiresAt: row.expires_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function isExpired(row: LicenseRow, now = Date.now()): boolean {
  return row.expires_at != null && row.expires_at <= now;
}

export function isExhausted(row: LicenseRow): boolean {
  return row.generation_limit != null && row.generation_limit > 0 && row.generations_used >= row.generation_limit;
}

export function findLicenseByKey(rawKey: string): LicenseRow | null {
  const row = getDb()
    .prepare("SELECT * FROM licenses WHERE key_hash = ?")
    .get(hashLicenseKey(rawKey)) as LicenseRow | undefined;
  return row ?? null;
}

export function findLicenseById(id: string): LicenseRow | null {
  const row = getDb().prepare("SELECT * FROM licenses WHERE id = ?").get(id) as
    | LicenseRow
    | undefined;
  return row ?? null;
}

export type LicenseCheck =
  | { ok: true; license: LicenseRow }
  | { ok: false; code: string; message: string; hint?: string };

export function checkLicenseUsable(row: LicenseRow | null): LicenseCheck {
  if (!row) {
    return {
      ok: false,
      code: "invalid_license",
      message: "That license key isn't valid.",
      hint: "Check for typos, or use the exact key you were issued.",
    };
  }
  if (row.status === "revoked") {
    return {
      ok: false,
      code: "license_revoked",
      message: "This license key has been revoked.",
      hint: "Contact support if you believe this is a mistake.",
    };
  }
  if (isExpired(row)) {
    return {
      ok: false,
      code: "license_expired",
      message: "This license key has expired.",
      hint: "Renew your license to keep generating scripts.",
    };
  }
  return { ok: true, license: row };
}

export function activateLicense(row: LicenseRow) {
  const now = Date.now();
  getDb()
    .prepare(
      "UPDATE licenses SET activated_at = COALESCE(activated_at, ?), last_seen_at = ? WHERE id = ?",
    )
    .run(now, now, row.id);
}

export function touchLicense(licenseId: string) {
  getDb().prepare("UPDATE licenses SET last_seen_at = ? WHERE id = ?").run(Date.now(), licenseId);
}

export function recordGeneration(licenseId: string, provider: string, model: string) {
  const db = getDb();
  db.prepare("UPDATE licenses SET generations_used = generations_used + 1, last_seen_at = ? WHERE id = ?").run(
    Date.now(),
    licenseId,
  );
  db.prepare(
    "INSERT INTO usage_events (license_id, type, provider, model, created_at) VALUES (?, 'generation', ?, ?, ?)",
  ).run(licenseId, provider, model, Date.now());
}

export function createLicense(input: {
  label?: string;
  expiresAt?: number | null;
  generationLimit?: number | null;
  notes?: string | null;
  key?: string;
}): { key: string; row: LicenseRow } {
  const key = input.key ?? generateLicenseKey();
  const normalized = normalizeLicenseKey(key);
  const now = Date.now();
  const id = `lic_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      `INSERT INTO licenses (id, key_hash, key_prefix, label, status, created_at, expires_at, generation_limit, generations_used, notes)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, ?)`,
    )
    .run(
      id,
      hashLicenseKey(normalized),
      normalized.slice(0, 6),
      input.label?.trim() || null,
      now,
      input.expiresAt ?? null,
      input.generationLimit && input.generationLimit > 0 ? input.generationLimit : null,
      input.notes ?? null,
    );
  return { key, row: findLicenseById(id)! };
}

export function listLicenses(search?: string): LicenseRow[] {
  const db = getDb();
  if (search && search.trim()) {
    return db
      .prepare(
        "SELECT * FROM licenses WHERE label LIKE ? OR key_prefix LIKE ? ORDER BY created_at DESC LIMIT 500",
      )
      .all(`%${search.trim()}%`, `%${search.trim()}%`) as LicenseRow[];
  }
  return db.prepare("SELECT * FROM licenses ORDER BY created_at DESC LIMIT 500").all() as LicenseRow[];
}

export function updateLicense(
  id: string,
  patch: {
    status?: "active" | "revoked";
    label?: string | null;
    expiresAt?: number | null;
    generationLimit?: number | null;
    notes?: string | null;
  },
) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.label !== undefined) {
    sets.push("label = ?");
    values.push(patch.label);
  }
  if (patch.expiresAt !== undefined) {
    sets.push("expires_at = ?");
    values.push(patch.expiresAt);
  }
  if (patch.generationLimit !== undefined) {
    sets.push("generation_limit = ?");
    values.push(patch.generationLimit);
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    values.push(patch.notes);
  }
  if (!sets.length) return;
  values.push(id);
  getDb()
    .prepare(`UPDATE licenses SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function deleteLicense(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE license_id = ?").run(id);
  db.prepare("DELETE FROM ai_configs WHERE license_id = ?").run(id);
  db.prepare("DELETE FROM licenses WHERE id = ?").run(id);
}

export function sessionCounts(): { total: number } {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number };
  return { total: row.c };
}
