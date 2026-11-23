import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ffmpegAvailable } from "@/lib/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = "ok";
  try {
    getDb().prepare("SELECT 1").get();
  } catch {
    db = "error";
  }
  return NextResponse.json(
    {
      ok: db === "ok",
      service: "hookmerge-ai",
      database: db,
      ffmpeg: await ffmpegAvailable(),
      time: new Date().toISOString(),
    },
    { status: db === "ok" ? 200 : 503 },
  );
}
