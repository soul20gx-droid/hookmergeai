import { ApiError } from "../api";
import { decryptSecret } from "../crypto";
import { getDb } from "../db";
import { getProvider, modernizeModel, resolveBaseUrl, PROVIDERS } from "./registry";
import { openAiChat, openAiTranscribe } from "./openai";
import { geminiChat, geminiTranscribe } from "./gemini";
import type { ChatMessage, ChatOptions, ResolvedAiConfig } from "./types";

export { PROVIDERS, getProvider, modernizeModel, resolveBaseUrl };
export type { ResolvedAiConfig, ChatMessage, ChatOptions };

export type StoredAiConfigRow = {
  license_id: string;
  provider: string;
  base_url: string;
  model: string;
  api_key_enc: string | null;
  key_mode: "stored" | "session"; // session retained for compatibility with existing database rows
  updated_at: number;
};

export function getStoredAiConfig(licenseId: string): StoredAiConfigRow | null {
  const row = getDb()
    .prepare("SELECT * FROM ai_configs WHERE license_id = ?")
    .get(licenseId) as StoredAiConfigRow | undefined;
  return row ?? null;
}

export function resolveAiConfig(input: {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey: string;
}): ResolvedAiConfig {
  const provider = getProvider(input.provider);
  if (!provider) {
    throw new ApiError(
      "unknown_provider",
      "Choose a supported AI provider.",
      400,
      `Supported providers: ${PROVIDERS.map((p) => p.label).join(", ")}.`,
    );
  }
  const baseUrl = resolveBaseUrl(input.provider, input.baseUrl);
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
    throw new ApiError(
      "invalid_base_url",
      "Enter a valid HTTPS API base URL.",
      400,
      "Example: https://api.together.xyz/v1",
    );
  }
  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const localHost =
      host === "localhost" || host.endsWith(".localhost") || host === "::1" ||
      host === "0.0.0.0" || host === "127.0.0.1" || host.startsWith("127.") ||
      host === "169.254.169.254" || host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
      host.endsWith(".internal") || host.endsWith(".local");
    if (parsed.username || parsed.password || parsed.search || parsed.hash || localHost) throw new Error("unsafe");
  } catch {
    throw new ApiError(
      "invalid_base_url",
      "That API base URL is not allowed.",
      400,
      "Use a public HTTPS endpoint without embedded credentials, query parameters, or local/private hostnames.",
    );
  }
  if (!input.model.trim()) {
    throw new ApiError("missing_model", "Choose or type a model identifier.", 400);
  }
  if (!input.apiKey.trim()) {
    throw new ApiError(
      "missing_api_key",
      "Add your AI provider API key.",
      400,
      "Open AI Configuration and paste your key.",
    );
  }
  return {
    provider: input.provider,
    kind: provider.kind,
    baseUrl,
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
  };
}

export function decryptedConfigFromRow(row: StoredAiConfigRow): ResolvedAiConfig | null {
  if (!row.api_key_enc) return null;
  try {
    return resolveAiConfig({
      provider: row.provider,
      model: modernizeModel(row.provider, row.model),
      baseUrl: row.base_url,
      apiKey: decryptSecret(row.api_key_enc),
    });
  } catch (err) {
    console.error("[hookmerge] could not decrypt AI config", err);
    return null;
  }
}

export async function runChat(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  if (config.kind === "gemini") return geminiChat(config, messages, options);
  return openAiChat(config, messages, options);
}

export async function transcribeAudio(
  config: ResolvedAiConfig,
  audio: { buffer: Buffer; mime: string; filename: string },
): Promise<string> {
  const provider = getProvider(config.provider);
  if (!provider?.supportsTranscription) {
    throw new ApiError(
      "transcription_unsupported",
      `${provider?.label ?? "Your provider"} can't transcribe audio.`,
      400,
      provider?.transcriptionNote ||
        "Paste the reference transcript instead, or connect OpenAI, Groq or Gemini.",
    );
  }

  if (provider.kind === "gemini") {
    return geminiTranscribe(config, audio);
  }

  const model =
    config.provider === "groq"
      ? "whisper-large-v3"
      : config.provider === "openai"
        ? "whisper-1"
        : "whisper-1";
  return openAiTranscribe(config, audio, model);
}

export async function testProviderConnection(config: ResolvedAiConfig): Promise<{
  latencyMs: number;
  sample: string;
}> {
  const started = Date.now();
  const sample = await runChat(
    config,
    [
      {
        role: "user",
        content: 'Reply with exactly this JSON: {"status":"ok"}',
      },
    ],
    // Reasoning models spend tokens on hidden reasoning before the visible
    // answer, so a tiny budget makes a perfectly valid key look broken.
    { temperature: 0, json: true, timeoutMs: 90_000 },
  );
  return { latencyMs: Date.now() - started, sample: sample.trim().slice(0, 120) };
}
