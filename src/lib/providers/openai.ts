import { appUrl } from "../env";
import { ApiError } from "../api";
import {
  extractJson,
  fetchWithTimeout,
  joinUrl,
  mapProviderError,
  type ChatMessage,
  type ChatOptions,
  type ResolvedAiConfig,
} from "./types";

type ChatCompletionResponse = {
  choices?: {
    message?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }[];
  error?: { message?: string };
};

export async function openAiChat(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const url = joinUrl(config.baseUrl, "/chat/completions");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = appUrl();
    headers["X-Title"] = "HookMerge AI";
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.75,
    stream: false,
  };
  // No output-token cap: let the provider use the model's full budget so
  // reasoning models never truncate before the visible answer.
  if (options.maxTokens && options.maxTokens > 0) body.max_tokens = options.maxTokens;
  if (options.json) body.response_format = { type: "json_object" };

  const send = async (payload: Record<string, unknown>) => {
    const res = await fetchWithTimeout(
      url,
      { method: "POST", headers, body: JSON.stringify(payload) },
      options.timeoutMs ?? 180_000,
      options.signal,
    );
    const text = await res.text();
    return { res, text };
  };

  let payload: Record<string, unknown> = { ...body };
  let { res, text } = await send(payload);

  // Newer reasoning models reject legacy parameters. Adapt once per rejection
  // (JSON mode, temperature, max_tokens → max_completion_tokens).
  const tried = new Set<string>();
  while (!res.ok && (res.status === 400 || res.status === 422) && tried.size < 3) {
    const detail = text.toLowerCase();
    let changed = false;

    if (payload.response_format && !tried.has("json")) {
      tried.add("json");
      delete payload.response_format;
      changed = true;
    } else if (
      payload.temperature !== undefined &&
      !tried.has("temperature") &&
      detail.includes("temperature")
    ) {
      tried.add("temperature");
      delete payload.temperature;
      changed = true;
    } else if (
      payload.max_tokens !== undefined &&
      !tried.has("max_tokens") &&
      /max_tokens|max_completion_tokens|max output/.test(detail)
    ) {
      tried.add("max_tokens");
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
      changed = true;
    }

    if (!changed) break;
    ({ res, text } = await send(payload));
  }

  if (!res.ok) {
    throw mapProviderError(res.status, text, providerLabel(config.provider));
  }

  const parsed = extractJson<ChatCompletionResponse>(text) ?? (JSON.parse(text) as ChatCompletionResponse);
  const choice = parsed.choices?.[0];
  const content = choice?.message?.content;
  if (!content || !content.trim()) {
    const truncated = choice?.finish_reason === "length";
    throw new ApiError(
      truncated ? "provider_response_truncated" : "empty_provider_response",
      truncated
        ? "Your provider ran out of output tokens before answering."
        : "Your AI provider returned an empty response.",
      502,
      truncated
        ? "Reasoning models use part of the budget on hidden thinking. Retry, or pick a faster model in AI Configuration."
        : "Retry the request or choose another model.",
    );
  }
  return content;
}

export async function openAiTranscribe(
  config: ResolvedAiConfig,
  audio: { buffer: Buffer; filename: string; mime: string },
  model: string,
): Promise<string> {
  const url = joinUrl(config.baseUrl, "/audio/transcriptions");
  const form = new FormData();
  form.append("model", model);
  form.append(
    "file",
    new Blob([new Uint8Array(audio.buffer)], { type: audio.mime }),
    audio.filename,
  );
  form.append("response_format", "json");

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    },
    240_000,
  );
  const text = await res.text();
  if (!res.ok) {
    throw mapProviderError(res.status, text, providerLabel(config.provider));
  }
  try {
    const parsed = JSON.parse(text) as { text?: string };
    if (parsed.text?.trim()) return parsed.text.trim();
  } catch {
    /* provider returned plain text */
  }
  if (text.trim()) return text.trim();
  throw new ApiError(
    "transcription_empty",
    "Transcription returned no text.",
    502,
    "The audio may be silent. Upload a different reference or paste the transcript.",
  );
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    nvidia: "NVIDIA NIM",
    openrouter: "OpenRouter",
    groq: "Groq",
    custom: "Your custom endpoint",
  };
  return labels[provider] ?? provider;
}
