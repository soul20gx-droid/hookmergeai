import { ApiError } from "../api";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type ResolvedAiConfig = {
  provider: string;
  kind: "openai" | "gemini";
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type ChatOptions = {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function isPublicAddress(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];
  const family = isIP(value);
  if (family === 4) {
    const octets = value.split(".").map(Number);
    const [a, b] = octets;
    return !(
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 2) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  // Permit globally-routable IPv6 unicast only; reject loopback, ULA,
  // link-local, multicast, unspecified and IPv4-mapped addresses.
  return family === 6 && /^[23]/.test(value);
}

async function assertPublicHttpsTarget(rawUrl: string): Promise<void> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new ApiError("invalid_provider_url", "The AI provider URL is invalid.", 400);
  }
  if (target.protocol !== "https:" || target.username || target.password) {
    throw new ApiError("invalid_provider_url", "AI provider requests must use public HTTPS endpoints.", 400);
  }
  const hostname = target.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new ApiError("provider_url_blocked", "Private or local provider endpoints are not allowed.", 400);
  }
  try {
    const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
      throw new Error("non-public address");
    }
  } catch {
    throw new ApiError(
      "provider_url_blocked",
      "That provider hostname does not resolve exclusively to public IP addresses.",
      400,
      "Use a public HTTPS API endpoint. Localhost, private networks and cloud metadata endpoints are blocked.",
    );
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<Response> {
  await assertPublicHttpsTarget(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = () => controller.abort(new Error("cancelled"));
  external?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
  } catch (err) {
    if (external?.aborted) {
      throw new ApiError("request_cancelled", "The generation was cancelled.", 409);
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/timeout|abort/i.test(message)) {
      throw new ApiError(
        "provider_timeout",
        "Your AI provider took too long to respond.",
        504,
        "Try a faster model or a shorter reference, then retry.",
      );
    }
    throw new ApiError(
      "provider_unreachable",
      "Could not reach your AI provider.",
      502,
      "Check your internet connection and the provider base URL, then retry.",
    );
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

export function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path}`;
}

export function mapProviderError(status: number, body: string, providerLabel: string): ApiError {
  const text = body.slice(0, 800);
  let detail = "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; code?: string | number; type?: string };
      message?: string;
    };
    detail = parsed.error?.message || parsed.message || "";
  } catch {
    detail = text;
  }
  const lower = `${detail} ${text}`.toLowerCase();

  if (status === 401 || status === 403) {
    return new ApiError(
      "invalid_api_key",
      `${providerLabel} rejected your API key.`,
      400,
      "Check the key in AI Configuration, make sure it has the right permissions, and test the connection again.",
    );
  }
  if (status === 429) {
    if (/quota|credit|billing|insufficient/.test(lower)) {
      return new ApiError(
        "quota_exhausted",
        "Your AI provider has reached its usage limit.",
        402,
        "Try another model or connect a different API key.",
      );
    }
    return new ApiError(
      "rate_limited",
      `${providerLabel} is rate limiting requests right now.`,
      429,
      "Wait a few seconds, then retry — or switch to another model.",
    );
  }
  if (
    status === 410 ||
    /end of life|end-of-life|no longer available|decommission|has been retired|model.*(not found|does not exist|unavailable)/.test(
      lower,
    )
  ) {
    return new ApiError(
      "model_unavailable",
      `${providerLabel} has retired that model.`,
      400,
      detail
        ? `${detail.slice(0, 240)} Pick a current model in AI Configuration, then test again.`
        : "Pick a current model in AI Configuration, then test again.",
    );
  }
  if (status === 404) {
    return new ApiError(
      "model_unavailable",
      "That model isn't available on your account.",
      400,
      "Pick a different model in AI Configuration or check the model identifier.",
    );
  }
  if (status === 400 || status === 422) {
    return new ApiError(
      "provider_bad_request",
      `${providerLabel} rejected the request.`,
      400,
      detail ? `Provider said: ${detail.slice(0, 240)}` : "Check the model and try again.",
    );
  }
  if (status >= 500) {
    return new ApiError(
      "provider_unavailable",
      `${providerLabel} is having trouble right now.`,
      502,
      "Retry in a moment, or switch provider/model.",
    );
  }
  return new ApiError(
    "provider_error",
    `${providerLabel} returned an error (${status}).`,
    502,
    detail ? detail.slice(0, 240) : undefined,
  );
}

export function extractJson<T>(raw: string): T | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through to brace scanning */
  }

  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
