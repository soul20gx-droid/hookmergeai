import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobCreateSchema } from "@/lib/validation";
import { assertGenerationAllowance, createJob, getJobRow, jobRowToView, startJob } from "@/lib/pipeline";
import { resolveRequestAiConfig } from "@/lib/ai-config";
import { parseYouTubeId } from "@/lib/youtube";
import { limitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requireLicense();
  limitByIp(req, "generate", 20, 10 * 60_000);
  assertGenerationAllowance(session.license);

  const body = jobCreateSchema.parse(await readJson(req));
  const config = await resolveRequestAiConfig(session.accountId);

  const reference: {
    kind: "file" | "youtube" | "transcript";
    fileId?: string;
    youtubeUrl?: string;
    title?: string;
    transcript?: string;
  } = { kind: body.referenceType };

  if (body.referenceType === "file") {
    if (!body.fileId) {
      throw new ApiError("missing_reference", "Upload a reference video first.", 400);
    }
    const file = getDb()
      .prepare("SELECT id FROM files WHERE id = ? AND account_id = ?")
      .get(body.fileId, session.accountId);
    if (!file) {
      throw new ApiError("file_not_found", "That upload isn't available.", 404, "Upload the video again.");
    }
    reference.fileId = body.fileId;
    reference.title = body.referenceTitle;
    if (body.transcript) reference.transcript = body.transcript;
  } else if (body.referenceType === "youtube") {
    if (!body.youtubeUrl || !parseYouTubeId(body.youtubeUrl)) {
      throw new ApiError(
        "invalid_youtube_url",
        "Paste a valid YouTube video link.",
        400,
        "Example: https://www.youtube.com/watch?v=…",
      );
    }
    reference.youtubeUrl = body.youtubeUrl;
    reference.title = body.referenceTitle;
    if (body.transcript) reference.transcript = body.transcript;
  } else {
    if (!body.transcript || body.transcript.trim().length < 20) {
      throw new ApiError(
        "transcript_required",
        "Paste the reference transcript.",
        400,
        "At least a few sentences, so the analysis has something to work with.",
      );
    }
    reference.transcript = body.transcript;
    reference.title = body.referenceTitle || "Pasted transcript";
  }

  const job = createJob(session.accountId, session.licenseId, {
    niche: body.niche,
    duration: body.duration,
    mode: body.mode,
    reference,
  });

  startJob(job.id, config);

  const row = getJobRow(job.id);
  return ok({ job: row ? jobRowToView(row) : job }, 202);
});

export const GET = withRoute(async () => {
  const session = await requireLicense();
  const rows = getDb()
    .prepare("SELECT * FROM jobs WHERE account_id = ? ORDER BY created_at DESC LIMIT 8")
    .all(session.accountId);
  return ok({
    jobs: rows.map((row) => jobRowToView(row as Parameters<typeof jobRowToView>[0])),
  });
});
