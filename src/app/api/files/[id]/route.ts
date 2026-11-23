import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { withRoute, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { absoluteUploadPath, deleteUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileRow = { id: string; license_id: string; path: string; name: string; size: number; mime: string };

export const GET = withRoute(async (req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;

  const row = getDb()
    .prepare("SELECT * FROM files WHERE id = ? AND account_id = ?")
    .get(id, session.accountId) as FileRow | undefined;
  if (!row) throw new ApiError("file_not_found", "That file is not available.", 404);

  const abs = absoluteUploadPath(row.path);
  if (!fs.existsSync(abs)) throw new ApiError("file_missing", "That file is no longer on disk.", 410);

  const stat = fs.statSync(abs);
  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": row.mime || "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : stat.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    const safeEnd = Math.min(end, stat.size - 1);
    const stream = fs.createReadStream(abs, { start, end: safeEnd });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${safeEnd}/${stat.size}`,
        "Content-Length": String(safeEnd - start + 1),
      },
    });
  }

  const stream = fs.createReadStream(abs);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
});

export const DELETE = withRoute(async (_req: NextRequest, ctx) => {
  const session = await requireLicense();
  const { id } = await ctx.params;
  const row = getDb()
    .prepare("SELECT * FROM files WHERE id = ? AND account_id = ?")
    .get(id, session.accountId) as FileRow | undefined;
  if (!row) throw new ApiError("file_not_found", "That file is not available.", 404);

  deleteUpload(row.path);
  getDb().prepare("DELETE FROM files WHERE id = ? AND account_id = ?").run(id, session.accountId);
  return new NextResponse(null, { status: 204 });
});
