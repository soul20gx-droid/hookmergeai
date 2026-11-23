import { NextRequest, NextResponse } from "next/server";
import { withRoute, ok } from "@/lib/api";
import { SESSION_COOKIE, destroySession, getSession } from "@/lib/auth";
import { licenseToView, isExpired, isExhausted } from "@/lib/license";
import { countScripts } from "@/lib/scripts";
import { getStoredAiConfig } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false, license: null });
  }
  const stored = getStoredAiConfig(session.licenseId);
  return NextResponse.json({
    ok: true,
    authenticated: true,
    license: licenseToView(session.license),
    usage: {
      scripts: countScripts(session.licenseId),
      expired: isExpired(session.license),
      exhausted: isExhausted(session.license),
    },
    aiConfigured: Boolean(stored?.api_key_enc),
  });
});

export const DELETE = withRoute(async (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  const res = ok({ authenticated: false });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set("hm_ai_key", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
});
