import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { providerTestSchema } from "@/lib/validation";
import { assertProvider } from "@/lib/ai-config";
import { resolveAiConfig, testProviderConnection } from "@/lib/providers";
import { getStoredAiConfig } from "@/lib/providers";
import { decryptSecret } from "@/lib/crypto";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requireLicense();
  limitByIp(req, "ai-test", 12, 60_000);
  const body = providerTestSchema.parse(await readJson(req));
  const provider = assertProvider(body.provider);

  let apiKey = body.apiKey?.trim() || "";
  if (!apiKey) {
    const stored = getStoredAiConfig(session.accountId);
    if (stored?.api_key_enc && stored.provider === body.provider) {
      apiKey = decryptSecret(stored.api_key_enc);
    }
  }
  if (!apiKey) {
    throw new ApiError(
      "missing_api_key",
      "Paste an API key to test the connection.",
      400,
      "We test the key directly against the provider — nothing is saved until you click Save.",
    );
  }

  const model = body.model.trim() || provider.models[0]?.id || "";
  const config = resolveAiConfig({
    provider: body.provider,
    model,
    baseUrl: body.baseUrl,
    apiKey,
  });

  try {
    const result = await testProviderConnection(config);
    return ok({
      provider: provider.label,
      model: config.model,
      latencyMs: result.latencyMs,
      sample: result.sample,
    });
  } catch (err) {
    throw err;
  }
});

