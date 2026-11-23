import fs from "node:fs";
import { ApiError } from "./api";
import { getDb, parseJson } from "./db";
import { fetchYouTubeReference } from "./youtube";
import { transcribeVideoFile } from "./transcribe";
import { absoluteUploadPath } from "./storage";
import {
  ANALYST_SYSTEM,
  ACTION_INSTRUCTIONS,
  MODE_CONFIG,
  analysisPrompt,
  revisionPrompt,
  scriptPrompt,
  strategyPrompt,
} from "./prompts";
import { extractJson } from "./providers/types";
import { runChat, type ResolvedAiConfig } from "./providers";
import type { Analysis, JobStage, JobView, Mode, ScriptStructure } from "./types";
import {
  getScript,
  insertScript,
  normalizeAnalysis,
  normalizeStructure,
  type ScriptRow,
} from "./scripts";
import { isExhausted, recordGeneration, type LicenseRow } from "./license";
import { probeDurationSeconds } from "./transcribe";

export type JobPayload = {
  niche: string;
  duration: number;
  mode: Mode;
  reference: {
    kind: "file" | "youtube" | "transcript";
    fileId?: string;
    youtubeUrl?: string;
    title?: string;
    transcript?: string;
  };
};

type GeneratedScript = {
  title?: unknown;
  hook?: unknown;
  body?: unknown;
  structure?: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __hookmergeActiveJobs: Map<string, AbortController> | undefined;
}

function activeJobs() {
  if (!globalThis.__hookmergeActiveJobs) globalThis.__hookmergeActiveJobs = new Map();
  return globalThis.__hookmergeActiveJobs;
}

export function cancelActiveJob(jobId: string) {
  activeJobs().get(jobId)?.abort();
}

export function assertGenerationAllowance(license: LicenseRow) {
  if (isExhausted(license)) {
    throw new ApiError(
      "generation_limit_reached",
      "This license has used all of its script generations.",
      403,
      "Ask your admin to raise the limit or issue a new license.",
    );
  }
}

/* ------------------------------- job storage ------------------------------ */

export type JobRow = {
  id: string;
  license_id: string;
  status: JobView["status"];
  stage: JobStage;
  progress: number;
  error_code: string | null;
  error_message: string | null;
  error_hint: string | null;
  payload: string | null;
  transcript: string | null;
  analysis: string | null;
  script_id: string | null;
  cancelled: number;
  created_at: number;
  updated_at: number;
};

export function getJobRow(jobId: string): JobRow | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  return row ?? null;
}

export function jobRowToView(row: JobRow): JobView {
  const payload = parseJson<JobPayload | null>(row.payload, null);
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    error:
      row.error_code && row.error_message
        ? { code: row.error_code, message: row.error_message, hint: row.error_hint ?? undefined }
        : null,
    scriptId: row.script_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    niche: payload?.niche ?? "",
    duration: payload?.duration ?? 30,
    mode: payload?.mode ?? "balanced",
  };
}

export function createJob(licenseId: string, payload: JobPayload): JobView {
  const id = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO jobs (id, license_id, status, stage, progress, payload, cancelled, created_at, updated_at)
       VALUES (?, ?, 'queued', 'queued', 0, ?, 0, ?, ?)`,
    )
    .run(id, licenseId, JSON.stringify(payload), now, now);

  // Keep the table small.
  getDb()
    .prepare("DELETE FROM jobs WHERE created_at < ? AND status IN ('completed','failed','cancelled')")
    .run(now - 7 * 24 * 60 * 60 * 1000);

  return jobRowToView(getJobRow(id)!);
}

export function markJobFailed(jobId: string, code: string, message: string, hint?: string) {
  getDb()
    .prepare(
      "UPDATE jobs SET status = 'failed', stage = 'failed', error_code = ?, error_message = ?, error_hint = ?, updated_at = ? WHERE id = ?",
    )
    .run(code, message, hint ?? null, Date.now(), jobId);
}

export function refreshStaleJob(row: JobRow): JobRow {
  if (row.status !== "queued" && row.status !== "running") return row;
  const age = Date.now() - row.updated_at;
  const idleTooLong = age > 20 * 60 * 1000;
  const orphaned = row.status === "running" && !activeJobs().has(row.id) && age > 5000;
  if (idleTooLong || orphaned) {
    markJobFailed(
      row.id,
      "generation_interrupted",
      "This generation was interrupted.",
      "Your server may have restarted mid-run. Start a new generation — it usually takes 20–90 seconds.",
    );
    return getJobRow(row.id)!;
  }
  return row;
}

/* --------------------------------- runner -------------------------------- */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatJson<T>(
  config: ResolvedAiConfig,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options: { temperature: number; signal: AbortSignal },
): Promise<T> {
  const raw = await runChat(config, messages, {
    json: true,
    temperature: options.temperature,
    timeoutMs: 240_000,
    signal: options.signal,
  });
  const parsed = extractJson<T>(raw);
  if (parsed) return parsed;

  const repaired = await runChat(
    config,
    [
      ...messages,
      { role: "assistant", content: raw.slice(0, 4000) },
      {
        role: "user",
        content: "That reply was not valid JSON. Return only the JSON object, no prose and no code fences.",
      },
    ],
    {
      json: true,
      temperature: options.temperature,
      timeoutMs: 240_000,
      signal: options.signal,
    },
  );
  const reparsed = extractJson<T>(repaired);
  if (!reparsed) {
    throw new ApiError(
      "invalid_ai_response",
      `${config.model} didn't return a usable structured response.`,
      502,
      "Retry, or switch to a model with stronger JSON reliability in AI Configuration.",
    );
  }
  return reparsed;
}

export function startJob(jobId: string, config: ResolvedAiConfig) {
  void runJob(jobId, config).catch((err) => {
    console.error("[hookmerge] job runner crashed", err);
    try {
      markJobFailed(jobId, "internal_error", "The generation crashed unexpectedly.", "Retry the generation.");
    } catch {
      /* db unavailable */
    }
  });
}

async function runJob(jobId: string, config: ResolvedAiConfig) {
  const db = getDb();
  const row = getJobRow(jobId);
  if (!row || !row.payload) return;
  const payload = parseJson<JobPayload | null>(row.payload, null);
  if (!payload) {
    markJobFailed(jobId, "invalid_job", "This job payload is corrupt.", "Start a new generation.");
    return;
  }

  const controller = new AbortController();
  activeJobs().set(jobId, controller);
  const startedAt = Date.now();
  const modeConfig = MODE_CONFIG[payload.mode] ?? MODE_CONFIG.balanced;

  const isCancelled = () => {
    const current = getJobRow(jobId);
    return !current || current.cancelled === 1 || current.status === "cancelled";
  };
  const guard = () => {
    if (isCancelled() || controller.signal.aborted) {
      throw new ApiError("job_cancelled", "Generation cancelled.", 409);
    }
  };
  const setStage = (stage: JobStage, progress: number) => {
    guard();
    db.prepare("UPDATE jobs SET status = 'running', stage = ?, progress = ?, updated_at = ? WHERE id = ?").run(
      stage,
      progress,
      Date.now(),
      jobId,
    );
  };

  try {
    /* 1 — reference ------------------------------------------------------- */
    setStage("processing_reference", 10);

    let referenceTitle = payload.reference.title?.trim() || "Reference video";
    let referenceSource = "Pasted transcript";
    let transcript = "";
    let referenceDuration: number | null = null;

    if (payload.reference.kind === "youtube") {
      guard();
      const url = payload.reference.youtubeUrl || "";
      let meta;
      try {
        meta = await fetchYouTubeReference(url);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          "youtube_unavailable",
          "Could not read that YouTube video.",
          502,
          "Check the link, or upload the video file instead.",
        );
      }
      referenceTitle = meta.title || referenceTitle;
      referenceSource = `YouTube · youtu.be/${meta.videoId}`;
      referenceDuration = meta.durationSeconds;
      transcript = meta.transcript?.trim() || "";

      if (!transcript && payload.reference.transcript?.trim()) {
        transcript = payload.reference.transcript.trim();
      }
      if (!transcript) {
        throw new ApiError(
          "missing_transcript",
          meta.transcriptReason
            ? `No transcript available: ${meta.transcriptReason}`
            : "No transcript is available for this video.",
          422,
          "Open the reference section and paste the video's transcript, or upload the video file with a provider that can transcribe audio (OpenAI, Groq, Gemini).",
        );
      }
    } else if (payload.reference.kind === "file") {
      guard();
      const file = db
        .prepare("SELECT * FROM files WHERE id = ? AND license_id = ?")
        .get(payload.reference.fileId ?? "", row.license_id) as
        | { id: string; path: string; name: string; size: number }
        | undefined;
      if (!file) {
        throw new ApiError(
          "file_not_found",
          "That uploaded video could not be found.",
          404,
          "Upload it again — uploads are tied to your license session.",
        );
      }
      const abs = absoluteUploadPath(file.path);
      if (!fs.existsSync(abs)) {
        throw new ApiError(
          "file_missing",
          "The uploaded video file is missing from storage.",
          410,
          "Upload it again to continue.",
        );
      }
      referenceTitle = file.name;
      referenceSource = `Uploaded video · ${file.name}`;
      referenceDuration = await probeDurationSeconds(abs);

      if (payload.reference.transcript?.trim()) {
        transcript = payload.reference.transcript.trim();
      } else {
        /* 2 — transcript for uploads --------------------------------------- */
        setStage("extracting_transcript", 28);
        const result = await transcribeVideoFile(config, abs);
        transcript = result.text.trim();
      }

      if (!transcript || transcript.length < 20) {
        throw new ApiError(
          "transcript_empty",
          "We couldn't extract speech from that video.",
          422,
          "Try a clip with clear narration, or paste the transcript manually.",
        );
      }
    } else {
      transcript = payload.reference.transcript?.trim() || "";
      if (transcript.length < 20) {
        throw new ApiError(
          "transcript_empty",
          "Paste at least a few lines of the reference transcript.",
          400,
          "The transcript is what we analyse — 50+ words works best.",
        );
      }
      referenceTitle = payload.reference.title?.trim() || "Pasted transcript";
    }

    /* 2 — transcript stage for youtube/transcript kinds ------------------- */
    setStage("extracting_transcript", 30);
    db.prepare("UPDATE jobs SET transcript = ?, updated_at = ? WHERE id = ?").run(
      transcript.slice(0, 120_000),
      Date.now(),
      jobId,
    );

    /* 3 — analysis -------------------------------------------------------- */
    setStage("analyzing_storytelling", 48);
    const analysisRaw = await chatJson<unknown>(
      config,
      [
        { role: "system", content: ANALYST_SYSTEM },
        {
          role: "user",
          content: analysisPrompt({
            transcript,
            niche: payload.niche,
            duration: referenceDuration ? Math.round(referenceDuration) : payload.duration,
            mode: payload.mode,
          }),
        },
      ],
      {
        temperature: 0.35,
        signal: controller.signal,
      },
    );
    const analysis: Analysis = normalizeAnalysis(analysisRaw);
    if (!analysis.central_idea && !analysis.opening_hook && !analysis.storytelling_format) {
      throw new ApiError(
        "analysis_failed",
        "The model didn't return a usable analysis of the reference.",
        502,
        "Try a stronger model or another provider.",
      );
    }
    db.prepare("UPDATE jobs SET analysis = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(analysis),
      Date.now(),
      jobId,
    );
    const analysisJson = JSON.stringify(analysis, null, 2);

    /* 4 — niche strategy -------------------------------------------------- */
    let strategyJson: string | null = null;
    if (modeConfig.runsStrategyStep) {
      setStage("understanding_niche", 66);
      const strategy = await chatJson<unknown>(
        config,
        [
          {
            role: "system",
            content:
              "You are HookMerge AI's creative director. You design original short-form concepts that borrow structure, not content.",
          },
          {
            role: "user",
            content: strategyPrompt({
              analysisJson,
              niche: payload.niche,
              duration: payload.duration,
              mode: payload.mode,
            }),
          },
        ],
        { temperature: 0.7, signal: controller.signal },
      );
      strategyJson = JSON.stringify(strategy, null, 2);
    }

    /* 5 — generation ------------------------------------------------------ */
    setStage("generating_script", 82);
    const generated = await chatJson<GeneratedScript>(
      config,
      [
        {
          role: "system",
          content:
            "You are HookMerge AI, an elite short-form scriptwriter. You write original, high-retention scripts that sound human and are ready to read on camera. You always answer with the requested JSON object.",
        },
        {
          role: "user",
          content: scriptPrompt({
            analysisJson,
            strategyJson,
            niche: payload.niche,
            duration: payload.duration,
            mode: payload.mode,
          }),
        },
      ],
      {
        temperature: modeConfig.temperature,
        signal: controller.signal,
      },
    );

    const body = typeof generated.body === "string" ? generated.body.trim() : "";
    if (!body) {
      throw new ApiError(
        "empty_script",
        "The model returned an empty script.",
        502,
        "Retry, or choose a different model.",
      );
    }
    const title =
      typeof generated.title === "string" && generated.title.trim()
        ? generated.title.trim().slice(0, 160)
        : `${payload.niche.slice(0, 48)} — short-form script`;
    const hook =
      typeof generated.hook === "string" && generated.hook.trim()
        ? generated.hook.trim()
        : body.split(/\n+/)[0].slice(0, 240);
    const structure: ScriptStructure | null = normalizeStructure(generated.structure);

    /* 6 — finalize -------------------------------------------------------- */
    setStage("finalizing", 95);
    const generationMs = Date.now() - startedAt;
    const script = insertScript({
      licenseId: row.license_id,
      title,
      hook,
      body,
      structure,
      analysis,
      niche: payload.niche,
      duration: payload.duration,
      mode: payload.mode,
      provider: config.provider,
      model: config.model,
      referenceTitle,
      referenceSource,
      generationMs,
    });

    db.prepare(
      "UPDATE jobs SET status = 'completed', stage = 'done', progress = 100, script_id = ?, updated_at = ? WHERE id = ?",
    ).run(script.id, Date.now(), jobId);

    recordGeneration(row.license_id, config.provider, config.model);
  } catch (err) {
    const cancelled = err instanceof ApiError && err.code === "job_cancelled";
    if (cancelled || isCancelled() || controller.signal.aborted) {
      db.prepare(
        "UPDATE jobs SET status = 'cancelled', stage = 'cancelled', updated_at = ? WHERE id = ?",
      ).run(Date.now(), jobId);
    } else if (err instanceof ApiError) {
      markJobFailed(jobId, err.code, err.message, err.hint);
    } else {
      console.error("[hookmerge] generation failed", err);
      markJobFailed(
        jobId,
        "generation_failed",
        err instanceof Error && /ENOENT|EACCES/.test(err.message)
          ? "The server could not read the uploaded video file."
          : "Generation failed unexpectedly.",
        "Retry. If it keeps failing, try another model or provider.",
      );
    }
  } finally {
    activeJobs().delete(jobId);
    await sleep(0);
  }
}

/* -------------------------------- actions -------------------------------- */

export async function runScriptAction(input: {
  licenseId: string;
  script: ScriptRow;
  action: "regenerate" | "new_version" | "improve_hook" | "more_engaging" | "shorten" | "expand";
  config: ResolvedAiConfig;
}): Promise<ReturnType<typeof getScript>> {
  const { script, licenseId, config, action } = input;
  const started = Date.now();
  const modeConfig = MODE_CONFIG[(script.mode as Mode) ?? "balanced"] ?? MODE_CONFIG.balanced;

  const analysisJson = script.analysis ? JSON.stringify(parseJson(script.analysis, {}), null, 2) : "{}";
  const current = JSON.stringify(
    {
      title: script.title,
      hook: script.hook,
      body: script.body,
      structure: parseJson(script.structure, null),
    },
    null,
    2,
  );

  let generated: GeneratedScript;

  if (action === "regenerate" || action === "new_version") {
    generated = await chatJson<GeneratedScript>(
      config,
      [
        {
          role: "system",
          content:
            "You are HookMerge AI, an elite short-form scriptwriter. You write original, high-retention scripts and answer with the requested JSON object.",
        },
        {
          role: "user",
          content: scriptPrompt({
            analysisJson,
            strategyJson: null,
            niche: script.niche,
            duration: script.duration,
            mode: (script.mode as Mode) ?? "balanced",
            variation: true,
          }),
        },
      ],
      { temperature: modeConfig.temperature, signal: new AbortController().signal },
    );
  } else {
    const instruction = ACTION_INSTRUCTIONS[action];
    generated = await chatJson<GeneratedScript>(
      config,
      [
        {
          role: "system",
          content:
            "You are HookMerge AI's script editor. You revise short-form scripts for retention and clarity, preserving the creator's voice. Answer with the requested JSON object.",
        },
        {
          role: "user",
          content: revisionPrompt({
            instruction,
            scriptJson: current,
            niche: script.niche,
            duration: script.duration,
            mode: (script.mode as Mode) ?? "balanced",
          }),
        },
      ],
      { temperature: 0.7, signal: new AbortController().signal },
    );
  }

  const body = typeof generated.body === "string" ? generated.body.trim() : "";
  if (!body) {
    throw new ApiError(
      "empty_script",
      "The model returned an empty revision.",
      502,
      "Retry, or pick a stronger model.",
    );
  }
  const title =
    typeof generated.title === "string" && generated.title.trim()
      ? generated.title.trim().slice(0, 160)
      : script.title;
  const hook =
    typeof generated.hook === "string" && generated.hook.trim()
      ? generated.hook.trim()
      : body.split(/\n+/)[0].slice(0, 240);

  const created = insertScript({
    licenseId,
    parentId: script.id,
    title,
    hook,
    body,
    structure: normalizeStructure(generated.structure) ?? parseJson(script.structure, null),
    analysis: parseJson(script.analysis, null),
    niche: script.niche,
    duration: script.duration,
    mode: (script.mode as Mode) ?? "balanced",
    provider: config.provider,
    model: config.model,
    referenceTitle: script.reference_title,
    referenceSource: script.reference_source,
    generationMs: Date.now() - started,
  });

  recordGeneration(licenseId, config.provider, config.model);
  return getScript(licenseId, created.id);
}

// Re-exported for API routes that need YouTube metadata without pulling the pipeline.
export { fetchYouTubeReference };
