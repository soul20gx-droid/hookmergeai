import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { getScript, scriptRowToRecord } from "@/lib/scripts";
import { getDb } from "@/lib/db";
import { actionSchema } from "@/lib/validation";
import { assertGenerationAllowance, runScriptAction } from "@/lib/pipeline";
import { resolveRequestAiConfig } from "@/lib/ai-config";
import type { ScriptRow } from "@/lib/scripts";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withRoute(async (req: NextRequest, ctx) => {
  const session = await requireLicense();
  limitByIp(req, "script-action", 40, 10 * 60_000);
  const { id } = await ctx.params;
  const { action } = actionSchema.parse(await readJson(req));

  assertGenerationAllowance(session.license);

  const row = getDb()
    .prepare("SELECT * FROM scripts WHERE id = ? AND license_id = ?")
    .get(id, session.licenseId) as ScriptRow | undefined;
  if (!row) throw new ApiError("script_not_found", "That script could not be found.", 404);

  const config = await resolveRequestAiConfig(session.licenseId);
  const script = await runScriptAction({ licenseId: session.licenseId, script: row, action, config });
  if (!script) throw new ApiError("generation_failed", "The revision could not be saved.", 500);

  return ok({ script });
});

void getScript;
void scriptRowToRecord;
