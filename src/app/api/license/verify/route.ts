import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRoute, ok, ApiError, readJson } from "@/lib/api";
import { licenseKeySchema } from "@/lib/validation";
import { licenseToView } from "@/lib/license";
import { SESSION_COOKIE, activateLicenseKey, sessionCookieOptions } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  limitByIp(req, "license-verify", 8, 60_000);
  const body = licenseKeySchema.parse(await readJson(req));

  const { license, token, maxAge } = activateLicenseKey(body.key);
  const res = NextResponse.json(
    { ok: true, license: licenseToView(license) },
    { status: 200 },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  res.cookies.set("hm_ai_key", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
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
void ApiError;
void ok;
