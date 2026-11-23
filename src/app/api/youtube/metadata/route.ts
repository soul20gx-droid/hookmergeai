import { NextRequest } from "next/server";
import { withRoute, ok, readJson, ApiError } from "@/lib/api";
import { requireLicense } from "@/lib/auth";
import { fetchYouTubeReference, parseYouTubeId } from "@/lib/youtube";
import { limitByIp } from "@/lib/rate-limit";
import { youtubeSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  await requireLicense();
  limitByIp(req, "youtube-meta", 30, 60_000);
  const { url } = youtubeSchema.parse(await readJson(req));

  if (!parseYouTubeId(url)) {
    throw new ApiError(
      "invalid_youtube_url",
      "That doesn't look like a YouTube video link.",
      400,
      "Paste a link such as https://www.youtube.com/watch?v=… or https://youtu.be/…",
    );
  }

  const meta = await fetchYouTubeReference(url);
  return ok({
    video: {
      videoId: meta.videoId,
      title: meta.title,
      author: meta.author,
      thumbnail: meta.thumbnail,
      durationSeconds: meta.durationSeconds,
      hasTranscript: Boolean(meta.transcript),
      transcriptLanguage: meta.transcriptLanguage,
      transcriptReason: meta.transcriptReason,
      transcriptPreview: meta.transcript ? meta.transcript.slice(0, 240) : null,
      url: `https://www.youtube.com/watch?v=${meta.videoId}`,
    },
  });
});
