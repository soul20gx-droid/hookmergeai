import { ApiError } from "./api";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { getDb } from "./db";
import {
  decryptedConfigFromRow,
  getStoredAiConfig,
  getProvider,
  modernizeModel,
  resolveAiConfig,
  resolveBaseUrl,
  type ResolvedAiConfig,
  PROVIDERS,
} from "./providers";
import type { AiConfigView } from "./types";

export async function getAiConfigView(licenseId: string): Promise<AiConfigView> {
  const stored = getStoredAiConfig(licenseId);
  if (!stored) {
    return {
      provider: "openai",
      model: "",
      baseUrl: "",
      keyMode: "none",
      hasKey: false,
      maskedKey: null,
      updatedAt: null,
    };
  }

  let masked: string | null = null;
  if (stored.api_key_enc) {
    try {
      masked = maskSecret(decryptSecret(stored.api_key_enc));
    } catch {
      masked = null;
    }
  }

  return {
    provider: stored.provider,
    model: modernizeModel(stored.provider, stored.model),
    baseUrl: stored.base_url,
    keyMode: stored.api_key_enc ? "stored" : "none",
    hasKey: Boolean(stored.api_key_enc),
    maskedKey: masked,
    updatedAt: stored.updated_at,
  };
}

/** Store config on the server (encrypted at rest) for this license. */
export function saveStoredAiConfig(
  licenseId: string,
  input: { provider: string; model: string; baseUrl: string; apiKey: string },
) {
  const resolved = resolveAiConfig(input);
  getDb()
    .prepare(
      `INSERT INTO ai_configs (license_id, provider, base_url, model, api_key_enc, key_mode, updated_at)
       VALUES (?, ?, ?, ?, ?, 'stored', ?)
       ON CONFLICT(license_id) DO UPDATE SET provider = excluded.provider, base_url = excluded.base_url,
         model = excluded.model, api_key_enc = excluded.api_key_enc, key_mode = 'stored', updated_at = excluded.updated_at`,
    )
    .run(
      licenseId,
      resolved.provider,
      resolved.baseUrl,
      resolved.model,
      encryptSecret(resolved.apiKey),
      Date.now(),
    );
  return resolved;
}

export function deleteStoredAiConfig(licenseId: string) {
  getDb().prepare("DELETE FROM ai_configs WHERE license_id = ?").run(licenseId);
}

/** Stored config with the decrypted key, ready for provider calls. */
export function storedResolvedConfig(licenseId: string): ResolvedAiConfig | null {
  const row = getStoredAiConfig(licenseId);
  if (!row) return null;
  return decryptedConfigFromRow(row);
}

/** Resolve only the encrypted configuration owned by this license. */
export async function resolveRequestAiConfig(licenseId: string): Promise<ResolvedAiConfig> {
  const stored = storedResolvedConfig(licenseId);
  if (stored) return stored;

  throw new ApiError(
    "ai_not_configured",
    "Connect your AI provider first.",
    400,
    "Open AI Configuration, paste your API key, pick a model, and save.",
  );
}

export function providerCatalog() {
  return PROVIDERS;
}

export function normalizeCustomBaseUrl(provider: string, baseUrl: string): string {
  return resolveBaseUrl(provider, baseUrl);
}

export function assertProvider(providerId: string) {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new ApiError(
      "unknown_provider",
      "Choose one of the supported AI providers.",
      400,
      `Supported: ${PROVIDERS.map((p) => p.label).join(", ")}.`,
    );
  }
  return provider;
}
