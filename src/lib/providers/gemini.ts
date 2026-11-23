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

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

function toGeminiBody(messages: ChatMessage[], options: ChatOptions) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.75,
      // No output-token cap unless the caller explicitly sets one.
      ...(options.maxTokens && options.maxTokens > 0
        ? { maxOutputTokens: options.maxTokens }
        : {}),
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return body;
}

async function callGemini(
  config: ResolvedAiConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = joinUrl(
    config.baseUrl,
    `/models/${encodeURIComponent(config.model)}:generateContent`,
  );
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
    signal,
  );
  const text = await res.text();
  if (!res.ok) throw mapProviderError(res.status, text, "Google Gemini");

  const parsed = extractJson<GeminiResponse>(text);
  if (!parsed) {
    throw new ApiError(
      "invalid_provider_response",
      "Gemini returned a response we could not read.",
      502,
      "Retry, or switch models in AI Configuration.",
    );
  }
  if (parsed.promptFeedback?.blockReason) {
    throw new ApiError(
      "content_blocked",
      "Gemini blocked this request.",
      400,
      "Try a different reference or niche wording.",
    );
  }
  const candidate = parsed.candidates?.[0];
  const content = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!content.trim()) {
    const truncated = candidate?.finishReason === "MAX_TOKENS";
    throw new ApiError(
      truncated ? "provider_response_truncated" : "empty_provider_response",
      truncated
        ? "Gemini ran out of output tokens before answering."
        : "Gemini returned an empty response.",
      502,
      truncated
        ? "Reasoning models use part of the budget on hidden thinking. Retry, or pick a faster model in AI Configuration."
        : "Retry, or switch models in AI Configuration.",
    );
  }
  return content;
}

export async function geminiChat(
  config: ResolvedAiConfig,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  return callGemini(config, toGeminiBody(messages, options), options.timeoutMs ?? 180_000, options.signal);
}

const MAX_INLINE_AUDIO_BYTES = 12 * 1024 * 1024;

export async function geminiTranscribe(
  config: ResolvedAiConfig,
  audio: { buffer: Buffer; mime: string },
): Promise<string> {
  if (audio.buffer.byteLength > MAX_INLINE_AUDIO_BYTES) {
    throw new ApiError(
      "audio_too_large",
      "This audio clip is too large for direct Gemini transcription.",
     413,
      "Use a shorter reference, or connect OpenAI/Groq for long-form transcription, or paste the transcript.",
    );
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe this audio verbatim. Return only the transcript text, with no commentary, timestamps or speaker labels.",
          },
          {
            inlineData: {
              mimeType: audio.mime,
              data: audio.buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  return callGemini(config, body, 240_000);
}
