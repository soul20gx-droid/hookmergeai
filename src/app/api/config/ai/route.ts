import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { aiConfigSchema } from "@/lib/validation";
import {
  assertProvider,
  deleteStoredAiConfig,
  encodeSessionConfig,
  getAiConfigView,
  readSessionConfig,
  saveStoredAiConfig,
  sessionKeyCookie,
  storedResolvedConfig,
} from "@/lib/ai-config";
import { PROVIDERS, resolveAiConfig } from "@/lib/providers";
import { decryptSecret } from "@/lib/crypto";
import { getStoredAiConfig } from "@/lib/providers";
import { serverAiFallback } from "@/lib/env";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  const session = await requireLicense();
  const view = await getAiConfigView(session.licenseId);
  return ok({
    config: view,
    providers: PROVIDERS,
    serverKeyAvailable: Boolean(serverAiFallback()),
  });
});

export const PUT = withRoute(async (req: NextRequest) => {
  const session = await requireLicense();
  limitByIp(req, "ai-config", 30, 60_000);
  const body = aiConfigSchema.parse(await readJson(req));
  const provider = assertProvider(body.provider);

  const model = body.model.trim() || provider.models[0]?.id || "";
  if (!model) {
    throw new ApiError("missing_model", "Choose or type a model identifier.", 400);
  }
  if (provider.allowCustomBaseUrl && !body.baseUrl?.trim()) {
    throw new ApiError(
      "missing_base_url",
      "Enter the base URL for your custom endpoint.",
      400,
      "Example: https://api.together.xyz/v1",
    );
  }

  if (body.keyMode === "none") {
    deleteStoredAiConfig(session.licenseId);
    const res = ok({ config: await getAiConfigView(session.licenseId) });
    res.cookies.set(sessionKeyCookie(null));
    return res;
  }

  if (body.keyMode === "session") {
    if (!body.apiKey?.trim()) {
      throw new ApiError("missing_api_key", "Paste your API key to use a session-only key.", 400);
    }
    const resolved = resolveAiConfig({
      provider: body.provider,
      model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    deleteStoredAiConfig(session.licenseId);
    const res = ok({
      config: {
        provider: resolved.provider,
        model: resolved.model,
        baseUrl: resolved.baseUrl,
        keyMode: "session" as const,
        hasKey: true,
        maskedKey: "•••• session only",
        updatedAt: Date.now(),
      },
    });
    res.cookies.set(
      sessionKeyCookie(
        encodeSessionConfig({
          provider: resolved.provider,
          model: resolved.model,
          baseUrl: resolved.baseUrl,
          apiKey: resolved.apiKey,
        }),
      ),
    );
    return res;
  }

  // stored: reuse the existing key when the user only changes provider/model.
  const existing = getStoredAiConfig(session.licenseId);
  let apiKey = body.apiKey?.trim() || "";
  // Only reuse a saved key for the same provider — a key from another provider
  // would be sent to the wrong API and fail with a misleading auth error.
  if (!apiKey && existing?.api_key_enc && existing.provider === body.provider) {
    apiKey = decryptSecret(existing.api_key_enc);
  }
  if (!apiKey) {
    const sessionCfg = await readSessionConfig();
    if (sessionCfg && sessionCfg.provider === body.provider) apiKey = sessionCfg.apiKey;
  }
  if (!apiKey) {
    throw new ApiError(
      "missing_api_key",
      "Paste your API key so we can save this configuration.",
      400,
      "Keys are encrypted before they touch the database.",
    );
  }

  saveStoredAiConfig(session.licenseId, {
    provider: body.provider,
    model,
    baseUrl: body.baseUrl ?? "",
    apiKey,
  });

  const res = ok({ config: await getAiConfigView(session.licenseId) });
  res.cookies.set(sessionKeyCookie(null));
  return res;
});

export const DELETE = withRoute(async () => {
  const session = await requireLicense();
  deleteStoredAiConfig(session.licenseId);
  const res = ok({ config: await getAiConfigView(session.licenseId) });
  res.cookies.set(sessionKeyCookie(null));
  return res;
});

void storedResolvedConfig;
