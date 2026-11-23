import { ApiError } from "./api";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { getDb, transaction } from "./db";
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

export async function getAiConfigView(accountId: string): Promise<AiConfigView> {
  const stored = getStoredAiConfig(accountId);
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

/** Store config on the server (encrypted at rest) for this account. */
export function saveStoredAiConfig(
  accountId: string,
  licenseId: string,
  input: { provider: string; model: string; baseUrl: string; apiKey: string },
) {
  const resolved = resolveAiConfig(input);
  transaction(() => {
    const db = getDb();
    // One configuration per account, even if the account has several licenses.
    db.prepare("DELETE FROM ai_configs WHERE account_id = ?").run(accountId);
    db.prepare(
      `INSERT INTO ai_configs (license_id, account_id, provider, base_url, model, api_key_enc, key_mode, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'stored', ?)`,
    ).run(
      licenseId,
      accountId,
      resolved.provider,
      resolved.baseUrl,
      resolved.model,
      encryptSecret(resolved.apiKey),
      Date.now(),
    );
  });
  return resolved;
}

export function deleteStoredAiConfig(accountId: string) {
  getDb().prepare("DELETE FROM ai_configs WHERE account_id = ?").run(accountId);
}

/** Stored config with the decrypted key, ready for provider calls. */
export function storedResolvedConfig(accountId: string): ResolvedAiConfig | null {
  const row = getStoredAiConfig(accountId);
  if (!row) return null;
  return decryptedConfigFromRow(row);
}

/** Resolve only the encrypted configuration owned by this account. */
export async function resolveRequestAiConfig(accountId: string): Promise<ResolvedAiConfig> {
  const stored = storedResolvedConfig(accountId);
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
