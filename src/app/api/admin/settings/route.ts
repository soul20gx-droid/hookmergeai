import { NextRequest } from "next/server";
import { withRoute, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";
import { getSetting, setSetting } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = [
  "license_generation_limit_default",
  "license_validity_days_default",
  "max_upload_mb",
] as const;

function readSettings() {
  const out: Record<string, number> = {};
  for (const key of KEYS) out[key] = Number(getSetting(key, "0")) || 0;
  return out;
}

export const GET = withRoute(async () => {
  await requireAdmin();
  return ok({ settings: readSettings() });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = settingsSchema.parse(await readJson(req));
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    setSetting(key, String(value));
  }
  return ok({ settings: readSettings() });
});
