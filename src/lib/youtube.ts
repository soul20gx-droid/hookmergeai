import { ApiError } from "./api";

export type YouTubeReference = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  durationSeconds: number | null;
  transcript: string | null;
  transcriptLanguage: string | null;
  transcriptReason: string | null;
};

/** Accepts watch, youtu.be, shorts, embed and live URLs. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
    return null;
  }

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  const v = url.searchParams.get("v");
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
    const id = parts[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
  }
  return null;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text?: string }[] };
};

async function fetchOEmbed(videoId: string): Promise<Partial<YouTubeReference>> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { headers: BROWSER_HEADERS, cache: "no-store" },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
    };
  } catch {
    return {};
  }
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text.replace(/(&amp;|&quot;|&#39;|&apos;|&lt;|&gt;|&nbsp;|&#\d+;)/g, (match) => {
    if (match.startsWith("&#")) {
      const code = Number(match.slice(2, -1));
      return Number.isFinite(code) ? String.fromCharCode(code) : match;
    }
    return ENTITIES[match] ?? match;
  });
}

async function fetchCaptionText(track: CaptionTrack): Promise<string | null> {
  if (!track.baseUrl) return null;
  const attempts = [
    `${track.baseUrl}&fmt=json3`,
    `${track.baseUrl}&fmt=srv3`,
    track.baseUrl,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
      if (!res.ok) continue;
      const body = await res.text();
      if (!body.trim()) continue;

      if (body.trim().startsWith("{")) {
        try {
          const json = JSON.parse(body) as {
            events?: { segs?: { utf8?: string }[] }[];
          };
          const text = (json.events ?? [])
            .map((event) => (event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (text) return text;
        } catch {
          /* try next format */
        }
      }

      if (body.includes("<text")) {
        const matches = [...body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];
        const text = matches
          .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return text;
      }

      const plain = body
        .replace(/^WEBVTT[\s\S]*?\n\n/, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (plain.length > 40) return decodeEntities(plain);
    } catch {
      /* keep trying other formats */
    }
  }
  return null;
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  const usable = tracks.filter((t) => t.baseUrl);
  if (!usable.length) return null;
  const manualEnglish = usable.find(
    (t) => t.kind !== "asr" && (t.languageCode || "").toLowerCase().startsWith("en"),
  );
  const manual = usable.find((t) => t.kind !== "asr");
  const english = usable.find((t) => (t.languageCode || "").toLowerCase().startsWith("en"));
  return manualEnglish ?? manual ?? english ?? usable[0];
}

/**
 * Reads public metadata and caption tracks from a YouTube watch page.
 * We never download or bypass protected media: if captions are unavailable the
 * caller asks the creator to paste a transcript or upload the file instead.
 */
export async function fetchYouTubeReference(input: string): Promise<YouTubeReference> {
  const videoId = parseYouTubeId(input);
  if (!videoId) {
    throw new ApiError(
      "invalid_youtube_url",
      "That doesn't look like a YouTube video link.",
      400,
      "Use a link like https://www.youtube.com/watch?v=… or https://youtu.be/…",
    );
  }

  const oembed = await fetchOEmbed(videoId);
  let title = oembed.title ?? `YouTube video ${videoId}`;
  let author = oembed.author ?? "";
  let thumbnail = oembed.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let durationSeconds: number | null = null;
  let transcript: string | null = null;
  let transcriptLanguage: string | null = null;
  let transcriptReason: string | null = null;

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) {
      transcriptReason = `YouTube returned HTTP ${res.status} for this video.`;
    } else {
      const html = await res.text();
      const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:var|<\/script>)/);
      if (playerMatch) {
        try {
          const player = JSON.parse(playerMatch[1]) as {
            videoDetails?: {
              title?: string;
              author?: string;
              lengthSeconds?: string;
              thumbnail?: { thumbnails?: { url?: string }[] };
            };
            captions?: {
              playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
            };
            playabilityStatus?: { status?: string; reason?: string };
          };
          const details = player.videoDetails;
          if (details?.title) title = details.title;
          if (details?.author) author = details.author;
          if (details?.lengthSeconds) durationSeconds = Number(details.lengthSeconds) || null;
          const thumbs = details?.thumbnail?.thumbnails;
          if (thumbs?.length) thumbnail = thumbs[thumbs.length - 1]?.url || thumbnail;

          const tracks =
            player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
          const track = pickTrack(tracks);
          if (track) {
            const text = await fetchCaptionText(track);
            if (text && text.length > 20) {
              transcript = text.slice(0, 120_000);
              transcriptLanguage = track.languageCode ?? null;
            } else {
              transcriptReason = "YouTube listed captions for this video, but the caption text could not be read.";
            }
          } else {
            transcriptReason =
              player.playabilityStatus?.status === "LOGIN_REQUIRED"
                ? "YouTube requires sign-in for this video, so captions are not accessible."
                : "This video has no public caption track.";
          }
        } catch {
          transcriptReason = "YouTube's page format changed and captions could not be parsed.";
        }
      } else {
        transcriptReason = "YouTube did not expose caption data for this video.";
      }
    }
  } catch {
    transcriptReason = "Could not reach YouTube from this server.";
  }

  return {
    videoId,
    title,
    author,
    thumbnail,
    durationSeconds,
    transcript,
    transcriptLanguage,
    transcriptReason,
  };
}
