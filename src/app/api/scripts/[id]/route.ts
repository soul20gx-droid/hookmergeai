import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { deleteScript, getScript, updateScript } from "@/lib/scripts";
import { scriptPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const script = getScript(session.accountId, id);
  if (!script) throw new ApiError("script_not_found", "That script could not be found.", 404);
  return ok({ script });
});

export const PATCH = withRoute(async (req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const patch = scriptPatchSchema.parse(await readJson(req));
  const updated = updateScript(session.accountId, id, patch);
  if (!updated) throw new ApiError("script_not_found", "That script could not be found.", 404);
  return ok({ script: updated });
});

export const DELETE = withRoute(async (_req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const removed = deleteScript(session.accountId, id);
  if (!removed) throw new ApiError("script_not_found", "That script could not be found.", 404);
  return ok({ deleted: true });
});
