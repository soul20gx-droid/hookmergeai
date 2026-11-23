import { NextRequest } from "next/server";
import { withRoute, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createLicense, listLicenses, licenseToView } from "@/lib/license";
import { adminLicenseCreateSchema } from "@/lib/validation";
import { getDb, getSetting } from "@/lib/db";
import type { AdminLicenseRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async (req: NextRequest) => {
  await requireAdmin();
  const search = req.nextUrl.searchParams.get("q") ?? "";
  const rows = listLicenses(search);
  const counts = getDb()
    .prepare("SELECT license_id, COUNT(*) as c FROM scripts GROUP BY license_id")
    .all() as { license_id: string; c: number }[];
  const countMap = new Map(counts.map((row) => [row.license_id, row.c]));

  const licenses: AdminLicenseRow[] = rows.map((row) => ({
    ...licenseToView(row),
    notes: row.notes,
    scripts: countMap.get(row.id) ?? 0,
  }));

  return ok({ licenses });
});

export const POST = withRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = adminLicenseCreateSchema.parse(await readJson(req));

  const defaultLimit = Number(getSetting("license_generation_limit_default", "0")) || 0;
  const defaultDays = Number(getSetting("license_validity_days_default", "0")) || 0;
  const generationLimit = body.generationLimit || defaultLimit || 0;
  const days = body.expiresInDays || defaultDays || 0;
  const expiresAt = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null;

  const created: { id: string; key: string }[] = [];
  for (let i = 0; i < body.quantity; i++) {
    const label = body.label
      ? body.quantity > 1
        ? `${body.label} ${i + 1}`
        : body.label
      : `License ${new Date().toISOString().slice(0, 10)}`;
    const result = createLicense({
      label,
      expiresAt,
      generationLimit: generationLimit > 0 ? generationLimit : null,
      notes: body.notes || null,
    });
    created.push({ id: result.row.id, key: result.key });
  }

  return ok({ created }, 201);
});
