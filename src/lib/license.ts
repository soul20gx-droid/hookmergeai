import { getDb, transaction } from "./db";
import {
  generateLicenseKey,
  hashLicenseKey,
  normalizeLicenseKey,
  randomId,
} from "./crypto";
import type { LicenseStatus, LicenseView } from "./types";

export type LicenseRow = {
  id: string;
  key_hash: string;
  key_prefix: string;
  key_last4: string | null;
  label: string | null;
  status: "active" | "revoked";
  account_id: string | null;
  created_at: number;
  activated_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
  last_seen_at: number | null;
  generation_limit: number | null;
  generations_used: number;
  notes: string | null;
};

export function isExpired(row: LicenseRow, now = Date.now()): boolean {
  return row.expires_at != null && row.expires_at <= now;
}

export function isExhausted(row: LicenseRow): boolean {
  return (
    row.generation_limit != null &&
    row.generation_limit > 0 &&
    row.generations_used >= row.generation_limit
  );
}

/** unused = never activated, active = activated and usable, expired, revoked. */
export function licenseStatus(row: LicenseRow, now = Date.now()): LicenseStatus {
  if (row.status === "revoked") return "revoked";
  if (isExpired(row, now)) return "expired";
  if (row.activated_at == null) return "unused";
  return "active";
}

export function licenseToView(row: LicenseRow): LicenseView {
  return {
    id: row.id,
    accountId: row.account_id ?? "",
    label: row.label,
    keyPrefix: row.key_prefix,
    keyLast4: row.key_last4,
    status: licenseStatus(row),
    generationLimit: row.generation_limit,
    generationsUsed: row.generations_used,
    expiresAt: row.expires_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
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

/**
 * Every license owns exactly one account. Returns the existing account ID, or
 * creates one and links it. Call inside a transaction when correctness matters.
 */
export function ensureLicenseAccount(row: LicenseRow): string {
  if (row.account_id) return row.account_id;
  const accountId = `acc_${randomId(8)}`;
  getDb()
    .prepare("INSERT INTO accounts (id, name, created_at) VALUES (?, ?, ?)")
    .run(accountId, row.label || null, Date.now());
  getDb().prepare("UPDATE licenses SET account_id = ? WHERE id = ?").run(accountId, row.id);
  return accountId;
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
  customerName?: string;
  expiresAt?: number | null;
  generationLimit?: number | null;
  notes?: string | null;
  key?: string;
}): { key: string; row: LicenseRow } {
  const key = (input.key ?? generateLicenseKey()).trim();
  const normalized = normalizeLicenseKey(key);
  const now = Date.now();
  const id = `lic_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const accountId = `acc_${randomId(8)}`;
  const name = (input.customerName ?? input.label ?? "").trim() || null;

  transaction(() => {
    getDb()
      .prepare("INSERT INTO accounts (id, name, created_at) VALUES (?, ?, ?)")
      .run(accountId, name, now);
    getDb()
      .prepare(
        `INSERT INTO licenses (id, key_hash, key_prefix, key_last4, label, status, account_id, created_at, expires_at, generation_limit, generations_used, notes)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?)`,
      )
      .run(
        id,
        hashLicenseKey(normalized),
        key.slice(0, 7).toUpperCase(),
        key.slice(-4).toUpperCase(),
        name,
        accountId,
        now,
        input.expiresAt ?? null,
        input.generationLimit && input.generationLimit > 0 ? input.generationLimit : null,
        input.notes ?? null,
      );
  });

  return { key, row: findLicenseById(id)! };
}

export function listLicenses(search?: string): LicenseRow[] {
  const db = getDb();
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    return db
      .prepare(
        "SELECT * FROM licenses WHERE label LIKE ? OR key_prefix LIKE ? OR key_last4 LIKE ? OR account_id LIKE ? ORDER BY created_at DESC LIMIT 500",
      )
      .all(term, term, term, term) as LicenseRow[];
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
    sets.push("revoked_at = ?");
    values.push(patch.status === "revoked" ? Date.now() : null);
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

/** Removes the license and every record owned by its account. */
export function deleteLicense(id: string) {
  const row = findLicenseById(id);
  if (!row) return;
  transaction(() => {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM ai_configs WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM scripts WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM jobs WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM files WHERE license_id = ?").run(id);
    db.prepare("DELETE FROM licenses WHERE id = ?").run(id);
    if (row.account_id) {
      const remaining = db
        .prepare("SELECT COUNT(*) as c FROM licenses WHERE account_id = ?")
        .get(row.account_id) as { c: number };
      if (remaining.c === 0) db.prepare("DELETE FROM accounts WHERE id = ?").run(row.account_id);
    }
  });
}

export function sessionCounts(): { total: number } {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number };
  return { total: row.c };
}
