import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ApiError } from "./api";
import { tmpRoot } from "./storage";
import { transcribeAudio, type ResolvedAiConfig } from "./providers";
import { serverAiFallback } from "./env";
import { getProvider, resolveBaseUrl } from "./providers/registry";

type ExecResult = { stdout: string; stderr: string };

function execFileAsync(bin: string, args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 24 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stderr: String(stderr || "") }));
          return;
        }
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      },
    );
  });
}

let ffmpegChecked: boolean | null = null;

export async function ffmpegAvailable(): Promise<boolean> {
  if (ffmpegChecked !== null) return ffmpegChecked;
  try {
    await execFileAsync("ffmpeg", ["-version"], 6000);
    ffmpegChecked = true;
  } catch {
    ffmpegChecked = false;
  }
  return ffmpegChecked;
}

export async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      15_000,
    );
    const seconds = Number(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

export async function extractAudioForTranscription(videoPath: string): Promise<{
  buffer: Buffer;
  mime: string;
  filename: string;
  cleanup: () => void;
}> {
  if (!(await ffmpegAvailable())) {
    throw new ApiError(
      "ffmpeg_missing",
      "Audio extraction is unavailable on this server (ffmpeg not found).",
      503,
      "Paste the reference transcript instead, or ask the operator to install ffmpeg.",
    );
  }

  const outPath = path.join(tmpRoot(), `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`);
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        "-f",
        "mp3",
        outPath,
      ],
      10 * 60 * 1000,
    );
    const buffer = fs.readFileSync(outPath);
    if (!buffer.byteLength) {
      throw new Error("empty audio");
    }
    return {
      buffer,
      mime: "audio/mpeg",
      filename: "reference-audio.mp3",
      cleanup: () => fs.existsSync(outPath) && fs.unlinkSync(outPath),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    const detail = (err as { stderr?: string }).stderr?.split("\n").filter(Boolean).slice(-2).join(" ");
    throw new ApiError(
      "audio_extraction_failed",
      "We couldn't read audio from that video file.",
      400,
      detail
        ? `ffmpeg said: ${detail.slice(0, 200)}`
        : "The file may be corrupted or use an unsupported codec. Try re-encoding it as MP4.",
    );
  }
}

export type TranscriptionResult = { text: string; method: string };

/**
 * Transcribes a local video file with the creator's own provider key.
 * If their provider cannot transcribe, an optional server fallback key is used,
 * otherwise we return a clear, actionable error.
 */
export async function transcribeVideoFile(
  config: ResolvedAiConfig,
  filePath: string,
): Promise<TranscriptionResult> {
  const provider = getProvider(config.provider);
  const audio = await extractAudioForTranscription(filePath);

  try {
    if (provider?.supportsTranscription) {
      const text = await transcribeAudio(config, audio);
      return { text, method: `${provider.label} transcription` };
    }

    const fallback = serverAiFallback();
    if (fallback) {
      const fallbackProvider = getProvider(fallback.provider);
      if (fallbackProvider?.supportsTranscription) {
        const fallbackConfig: ResolvedAiConfig = {
          provider: fallback.provider,
          kind: fallbackProvider.kind,
          baseUrl: resolveBaseUrl(fallback.provider),
          model: fallbackProvider.models[0]?.id ?? "whisper-1",
          apiKey: fallback.apiKey,
        };
        const text = await transcribeAudio(fallbackConfig, audio);
        return { text, method: `${fallbackProvider.label} (server key) transcription` };
      }
    }

    throw new ApiError(
      "transcription_unsupported",
      `${provider?.label ?? "Your AI provider"} can't transcribe audio.`,
      400,
      "Paste the reference transcript below the upload, or connect OpenAI, Groq or Gemini for automatic transcription.",
    );
  } finally {
    audio.cleanup();
  }
}
