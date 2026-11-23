import { NextRequest, NextResponse } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { ADMIN_COOKIE, checkAdminPassword, createAdminSession, sessionCookieOptions, destroyAdminSession, isAdmin } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validation";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  limitByIp(req, "admin-login", 6, 60_000);
  const { password } = adminLoginSchema.parse(await readJson(req));
  if (!checkAdminPassword(password)) {
    throw new ApiError(
      "admin_invalid",
      "Incorrect admin password.",
      401,
      "Admin access uses ADMIN_SECRET, which is separate from license keys.",
    );
  }
  const { token, maxAge } = createAdminSession();
  const res = ok({ authenticated: true });
  res.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
});

export const GET = withRoute(async () => {
  return ok({ authenticated: await isAdmin() });
});

export const DELETE = withRoute(async (req: NextRequest) => {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (token) destroyAdminSession(token);
  const res = ok({ authenticated: false });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});

void NextResponse;
