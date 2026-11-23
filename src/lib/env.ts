import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const SECRET_FILE = path.join(DATA_DIR, ".secrets.json");

let cachedSecrets: Record<string, string> | null = null;

function loadSecrets(): Record<string, string> {
  if (cachedSecrets) return cachedSecrets;
  try {
    cachedSecrets = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8")) as Record<string, string>;
  } catch {
    cachedSecrets = {};
  }
  return cachedSecrets;
}

/**
 * Secrets come from the environment. In local development, when a secret is
 * absent we generate one and persist it server-side (data/.secrets.json, never
 * shipped to the browser) so the app is usable out of the box.
 */
function secret(name: string): string {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;

  const secrets = loadSecrets();
  if (!secrets[name]) {
    secrets[name] = randomBytes(32).toString("hex");
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SECRET_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn(`[hookmerge] could not persist generated ${name}`, err);
    }
  }
  return secrets[name];
}

function resolveFromRoot(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export function databasePath(): string {
  const raw = (process.env.DATABASE_URL || "file:./data/hookmerge.db").trim();
  if (!raw.startsWith("file:")) {
    throw new Error(
      "This build uses the embedded SQLite driver. DATABASE_URL must look like file:./data/hookmerge.db",
    );
  }
  return resolveFromRoot(raw.slice("file:".length));
}

export function licenseSecret(): string {
  return secret("LICENSE_SECRET");
}

export function adminSecret(): string {
  const value = process.env.ADMIN_SECRET?.trim();
  if (value) return value;
  const generated = secret("ADMIN_SECRET");
  console.warn(
    "[hookmerge] ADMIN_SECRET is not set. Using a generated admin password stored in data/.secrets.json.",
  );
  return generated;
}

export function encryptionKey(): string {
  return secret("ENCRYPTION_KEY");
}

export function initialLicenseKey(): string {
  return (process.env.INITIAL_LICENSE_KEY || "").trim();
}

export function storageDir(): string {
  return resolveFromRoot((process.env.STORAGE_DIR || "./storage").trim());
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 200);
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 200;
  return Math.round(safe * 1024 * 1024);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function serverAiFallback(): { provider: string; apiKey: string } | null {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) return null;
  return { provider: (process.env.AI_PROVIDER || "openai").trim(), apiKey: key };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
