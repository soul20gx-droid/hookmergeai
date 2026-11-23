import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { randomId } from "@/lib/crypto";
import { withRoute, ok, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { validateVideoUpload, relativeUploadPath, writeUpload, absoluteUploadPath, mimeForExtension } from "@/lib/storage";
import { probeDurationSeconds } from "@/lib/transcribe";
import { getDb } from "@/lib/db";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requireLicense();
  limitByIp(req, "upload", 20, 60_000);

  const contentLength = Number(req.headers.get("content-length") || 0);
  const maxAllowed = 1024 * 1024 * 1024;
  if (contentLength > maxAllowed) {
    throw new ApiError("file_too_large", "That upload is too large.", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(
      "upload_failed",
      "The upload didn't complete.",
      400,
      "Check your connection and try again, or use a smaller file.",
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError("missing_file", "Choose a video file to upload.", 400);
  }

  const ext = validateVideoUpload(file.name, file.type, file.size);
  const fileId = randomId(12);
  const relPath = relativeUploadPath(session.licenseId, fileId, ext);

  let durationSeconds: number | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const abs = writeUpload(relPath, buffer);
    durationSeconds = await probeDurationSeconds(abs);
    if (durationSeconds === null) {
      const stats = fs.statSync(abs);
      if (!stats.size) throw new Error("empty file");
    }
  } catch (err) {
    const { deleteUpload } = await import("@/lib/storage");
    deleteUpload(relPath);
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      "upload_failed",
      "We couldn't store that video.",
      500,
      "Check the server's storage directory permissions and disk space.",
    );
  }

  getDb()
    .prepare(
      "INSERT INTO files (id, license_id, account_id, path, name, size, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      fileId,
      session.licenseId,
      session.accountId,
      relPath,
      file.name.slice(0, 240),
      file.size,
      file.type || mimeForExtension(ext),
      Date.now(),
    );

  return ok({
    file: {
      id: fileId,
      name: file.name,
      size: file.size,
      mime: file.type || mimeForExtension(ext),
      durationSeconds,
      previewUrl: `/api/files/${fileId}`,
    },
  });
});

void NextResponse;
void absoluteUploadPath;
