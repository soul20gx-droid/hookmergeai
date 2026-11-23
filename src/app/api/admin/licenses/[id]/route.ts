import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminLicensePatchSchema } from "@/lib/validation";
import { deleteLicense, findLicenseById, licenseToView, updateLicense } from "@/lib/license";
import { destroyAllSessionsForLicense } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export const PATCH = withRoute(async (req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = adminLicensePatchSchema.parse(await readJson(req));

  const existing = findLicenseById(id);
  if (!existing) throw new ApiError("license_not_found", "That license does not exist.", 404);

  if (body.action === "delete") {
    deleteLicense(id);
    return ok({ deleted: true });
  }

  if (body.action === "revoke") {
    updateLicense(id, { status: "revoked" });
    destroyAllSessionsForLicense(id);
  } else if (body.action === "activate") {
    updateLicense(id, { status: "active" });
  }

  const patch: Parameters<typeof updateLicense>[1] = {};
  const name = body.customerName ?? body.label;
  if (name !== undefined) patch.label = name || null;
  if (body.notes !== undefined) patch.notes = body.notes || null;
  if (body.expiry !== undefined) {
    const days = body.expiry === "lifetime" ? 0 : Number(body.expiry);
    patch.expiresAt = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
  } else if (body.clearExpiry) patch.expiresAt = null;
  else if (body.expiresInDays !== undefined) {
    patch.expiresAt =
      body.expiresInDays > 0 ? Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000 : null;
  }
  if (body.generationLimit !== undefined) {
    patch.generationLimit = body.generationLimit > 0 ? body.generationLimit : null;
  }
  if (Object.keys(patch).length) updateLicense(id, patch);

  const updated = findLicenseById(id);
  if (!updated) throw new ApiError("license_not_found", "That license does not exist.", 404);
  const count = getDb()
    .prepare("SELECT COUNT(*) as c FROM scripts WHERE license_id = ?")
    .get(id) as { c: number };

  return ok({
    license: { ...licenseToView(updated), notes: updated.notes, scripts: count.c },
  });
});
