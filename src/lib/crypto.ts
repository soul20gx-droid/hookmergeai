import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { encryptionKey, licenseSecret } from "./env";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function normalizeLicenseKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "");
}

export function hashLicenseKey(key: string): string {
  return sha256Hex(`${licenseSecret()}:${normalizeLicenseKey(key)}`);
}

/** A human-friendly license key; the leading group makes support easier. */
export function generateLicenseKey(): string {
  const raw = randomBytes(15).toString("hex").toUpperCase(); // 30 chars
  return `HM-${raw.match(/.{1,5}/g)!.join("-")}`;
}

function encryptionKeyBytes(): Buffer {
  return createHash("sha256").update(encryptionKey()).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKeyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKeyBytes(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still compare something to keep timing flat.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}${"•".repeat(Math.min(14, value.length - 8))}${value.slice(-4)}`;
}
