import { cookies } from "next/headers";
import { getDb } from "./db";
import { randomToken, sha256Hex, safeEqual } from "./crypto";
import { adminSecret } from "./env";
import { ApiError } from "./api";
import { activateLicense, checkLicenseUsable, findLicenseById, licenseToView, type LicenseRow } from "./license";

export const SESSION_COOKIE = "hm_session";
export const ADMIN_COOKIE = "hm_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export type LicensedSession = { license: LicenseRow; licenseId: string };

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function createSession(licenseId: string): { token: string; maxAge: number } {
  const token = randomToken(32);
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO sessions (token_hash, license_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(sha256Hex(token), licenseId, now, now + SESSION_TTL_MS, now);
  const license = findLicenseById(licenseId);
  if (license) activateLicense(license);
  return { token, maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

export function destroySession(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256Hex(token));
}

export function destroyAllSessionsForLicense(licenseId: string) {
  getDb().prepare("DELETE FROM sessions WHERE license_id = ?").run(licenseId);
}

export async function getSession(): Promise<LicensedSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare("SELECT s.token_hash, s.license_id, s.expires_at, s.last_seen_at FROM sessions s WHERE s.token_hash = ?")
    .get(sha256Hex(token)) as
    | { token_hash: string; license_id: string; expires_at: number; last_seen_at: number }
    | undefined;
  if (!row) return null;

  const now = Date.now();
  if (row.expires_at <= now) {
    destroySession(token);
    return null;
  }

  const license = findLicenseById(row.license_id);
  if (!license) return null;

  const check = checkLicenseUsable(license);
  if (!check.ok) return null;

  if (now - row.last_seen_at > 60_000) {
    getDb()
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
      .run(now, row.token_hash);
    getDb().prepare("UPDATE licenses SET last_seen_at = ? WHERE id = ?").run(now, license.id);
  }

  return { license, licenseId: license.id };
}

export async function requireLicense(): Promise<LicensedSession> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(
      "not_authorized",
      "Your license session is missing or expired.",
      401,
      "Verify your license key again to continue.",
    );
  }
  return session;
}

export function buildLicenseSessionPayload(license: LicenseRow) {
  return {
    license: licenseToView(license),
    hasStoredKey: false as boolean,
  };
}

/* --------------------------------- admin --------------------------------- */

export function createAdminSession(): { token: string; maxAge: number } {
  const token = randomToken(32);
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .run(sha256Hex(token), now, now + ADMIN_TTL_MS);
  return { token, maxAge: Math.floor(ADMIN_TTL_MS / 1000) };
}

export function checkAdminPassword(password: string): boolean {
  return safeEqual(password, adminSecret());
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const row = getDb()
    .prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?")
    .get(sha256Hex(token)) as { expires_at: number } | undefined;
  if (!row) return false;
  if (row.expires_at <= Date.now()) {
    getDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256Hex(token));
    return false;
  }
  return true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new ApiError("admin_required", "Admin authentication required.", 401);
  }
}

export function destroyAdminSession(token: string) {
  getDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256Hex(token));
}
