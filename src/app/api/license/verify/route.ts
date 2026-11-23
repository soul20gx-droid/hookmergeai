import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoute, ok, ApiError, readJson } from "@/lib/api";
import { licenseKeySchema } from "@/lib/validation";
import { findLicenseByKey, checkLicenseUsable, licenseToView } from "@/lib/license";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  limitByIp(req, "license-verify", 8, 60_000);
  const body = licenseKeySchema.parse(await readJson(req));

  const license = findLicenseByKey(body.key);
  const check = checkLicenseUsable(license);
  if (!check.ok || !license) {
    const failure = check.ok ? null : check;
    throw new ApiError(
      failure?.code ?? "invalid_license",
      failure?.message ?? "That license key isn't valid.",
      401,
      failure?.hint,
    );
  }

  const { token, maxAge } = createSession(license.id);
  const res = NextResponse.json(
    { ok: true, license: licenseToView({ ...license, activated_at: license.activated_at ?? Date.now() }) },
    { status: 200 },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
});

// Small helper for clients that probe the endpoint directly.
export const GET = withRoute(async () => {
  return NextResponse.json(
    { ok: false, error: { code: "method_not_allowed", message: "Use POST with a license key." } },
    { status: 405 },
  );
});

void z;
void ok;
