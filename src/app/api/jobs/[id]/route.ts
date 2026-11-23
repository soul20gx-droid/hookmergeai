import { NextRequest } from "next/server";
import { withRoute, ok, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import {
  cancelActiveJob,
  getJobRow,
  jobRowToView,
  refreshStaleJob,
} from "@/lib/pipeline";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const row = getJobRow(id);
  if (!row || row.license_id !== session.licenseId) {
    throw new ApiError("job_not_found", "That generation could not be found.", 404);
  }
  return ok({ job: jobRowToView(refreshStaleJob(row)) });
});

export const DELETE = withRoute(async (_req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const row = getJobRow(id);
  if (!row || row.license_id !== session.licenseId) {
    throw new ApiError("job_not_found", "That generation could not be found.", 404);
  }
  if (row.status === "queued" || row.status === "running") {
    getDb().prepare("UPDATE jobs SET cancelled = 1, updated_at = ? WHERE id = ?").run(Date.now(), id);
    cancelActiveJob(id);
  }
  return ok({ job: jobRowToView(getJobRow(id)!) });
});
