import type { ProviderInfo } from "../types";

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    tagline: "Free hosted Llama, Nemotron and DeepSeek endpoints.",
    kind: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    docsUrl: "https://build.nvidia.com",
    keyHint: "nvapi-...",
    freeTier: true,
    supportsTranscription: false,
    transcriptionNote: "NIM has no OpenAI-compatible audio endpoint — paste a transcript for video analysis.",
    allowCustomBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "nvidia/nemotron-3.5-lightning-30b-a3b", label: "Nemotron 3.5 Lightning 30B", tier: "fast" },
      { id: "meta/muse-glimmer-30b", label: "Meta Muse Glimmer 30B", tier: "balanced" },
      { id: "moonshotai/kimi-k3.1-pro", label: "Kimi K3.1 Pro", tier: "premium" },
      { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra 550B", tier: "premium" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    tagline: "GPT models plus Whisper transcription in one key.",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
    freeTier: false,
    supportsTranscription: true,
    transcriptionNote: "Uploaded video audio is transcribed with whisper-1.",
    allowCustomBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", tier: "fast" },
      { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", tier: "balanced" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", tier: "premium" },
      { id: "gpt-6-astra", label: "GPT-6 Astra", tier: "premium" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    tagline: "Long-context models that can listen to your video directly.",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
    freeTier: true,
    supportsTranscription: true,
    transcriptionNote: "Audio can be sent straight to Gemini — no whisper key needed.",
    allowCustomBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", tier: "fast" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", tier: "balanced" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", tier: "premium" },
      { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen", tier: "premium" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tagline: "One key, hundreds of models from every major lab.",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-v1-...",
    freeTier: true,
    supportsTranscription: false,
    transcriptionNote: "OpenRouter is text-only — paste a transcript for video analysis.",
    allowCustomBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", tier: "fast" },
      { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", tier: "balanced" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", tier: "balanced" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", tier: "balanced" },
      { id: "openai/gpt-6.1-terra", label: "GPT-6.1 Terra", tier: "premium" },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", tier: "premium" },
      { id: "google/gemini-4-hydrogen", label: "Gemini 4 Hydrogen", tier: "premium" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    tagline: "Extremely fast inference with free Whisper transcription.",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    freeTier: true,
    supportsTranscription: true,
    transcriptionNote: "Uploaded video audio is transcribed with whisper-large-v3.",
    allowCustomBaseUrl: false,
    allowCustomModel: true,
    models: [
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", tier: "fast" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", tier: "fast" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", tier: "balanced" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", tier: "balanced" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", tier: "premium" },
    ],
  },
  {
    id: "custom",
    label: "Custom endpoint",
    tagline: "Any OpenAI-compatible API: Together, DeepInfra, vLLM, Ollama…",
    kind: "openai",
    baseUrl: "",
    docsUrl: "",
    keyHint: "your-api-key",
    freeTier: false,
    supportsTranscription: true,
    transcriptionNote: "Attempts /audio/transcriptions on your endpoint.",
    allowCustomBaseUrl: true,
    allowCustomModel: true,
    models: [],
  },
];

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function resolveBaseUrl(providerId: string, customBaseUrl?: string): string {
  const provider = getProvider(providerId);
  if (!provider) return "";
  if (provider.allowCustomBaseUrl) return (customBaseUrl || "").trim().replace(/\/+$/, "");
  return provider.baseUrl;
}

export function isKnownProvider(id: string): boolean {
  return Boolean(getProvider(id));
}

/**
 * Models that providers have retired, mapped to the closest current model.
 * Saved configurations using an old ID are migrated automatically so a valid
 * key keeps working after a provider ends-of-lifes a model.
 */
const RETIRED_MODEL_REPLACEMENTS: Record<string, Record<string, string>> = {
  nvidia: {
    "meta/llama-3.3-70b-instruct": "nvidia/nemotron-3.5-lightning-30b-a3b",
    "meta/llama-3.1-8b-instruct": "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/llama-3.1-nemotron-70b-instruct": "moonshotai/kimi-k3.1-pro",
    "deepseek-ai/deepseek-r1": "nvidia/nemotron-3-ultra-550b-a55b",
    "mistralai/mistral-7b-instruct-v0.3": "nvidia/nemotron-3.5-lightning-30b-a3b",
  },
  gemini: {
    "gemini-2.0-flash": "gemini-3.5-flash-lite",
    "gemini-2.5-flash": "gemini-3.8-flash",
    "gemini-2.5-pro": "gemini-3.1-pro-preview",
    "gemini-3.6-flash": "gemini-3.8-flash",
  },
  openrouter: {
    "google/gemini-2.0-flash-001": "google/gemini-3.8-flash",
    "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-4.5",
  },
  groq: {
    "qwen/qwen3-32b": "qwen/qwen3.8-27b",
  },
};

export function modernizeModel(providerId: string, model: string): string {
  const map = RETIRED_MODEL_REPLACEMENTS[providerId];
  if (!map) return model;
  const key = model.trim();
  return map[key] ?? map[key.toLowerCase()] ?? model;
}
