import fs from "node:fs";
import path from "node:path";
import { ApiError } from "./api";
import { maxUploadBytes, storageDir } from "./env";
import { getSetting } from "./db";

export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"] as const;

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

export function uploadSizeLimit(): number {
  const configuredMb = Number(getSetting("max_upload_mb", ""));
  if (Number.isFinite(configuredMb) && configuredMb > 0) return configuredMb * 1024 * 1024;
  return maxUploadBytes();
}

export function validateVideoUpload(name: string, mime: string, size: number): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(ext as (typeof VIDEO_EXTENSIONS)[number])) {
    throw new ApiError(
      "unsupported_video",
      `Unsupported video format${ext ? ` (.${ext})` : ""}.`,
      400,
      "Upload an MP4, MOV, WEBM or M4V file.",
    );
  }
  if (mime && !mime.startsWith("video/") && mime !== "application/octet-stream") {
    throw new ApiError(
      "unsupported_video",
      "That file doesn't look like a video.",
      400,
      "Upload an MP4, MOV, WEBM or M4V file.",
    );
  }
  const limit = uploadSizeLimit();
  if (size <= 0) {
    throw new ApiError("empty_upload", "That file is empty.", 400);
  }
  if (size > limit) {
    throw new ApiError(
      "file_too_large",
      `That file is ${(size / (1024 * 1024)).toFixed(1)} MB. The limit is ${(limit / (1024 * 1024)).toFixed(0)} MB.`,
      413,
      "Trim the clip or raise the upload limit in admin settings.",
    );
  }
  return ext;
}

export function uploadsRoot(): string {
  const dir = path.join(storageDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function tmpRoot(): string {
  const dir = path.join(storageDir(), "tmp");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function relativeUploadPath(licenseId: string, fileId: string, ext: string) {
  return path.posix.join(licenseId, `${fileId}.${ext}`);
}

export function absoluteUploadPath(relativePath: string): string {
  const root = uploadsRoot();
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new ApiError("invalid_path", "Invalid file reference.", 400);
  }
  return resolved;
}

export function writeUpload(relativePath: string, data: Buffer): string {
  const abs = absoluteUploadPath(relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return abs;
}

export function deleteUpload(relativePath: string) {
  try {
    const abs = absoluteUploadPath(relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* already gone */
  }
}

export function mimeForExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}
