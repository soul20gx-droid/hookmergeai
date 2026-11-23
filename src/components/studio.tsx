"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  Ban,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardPaste,
  Clock3,
  FileText,
  FileVideo,
  Gauge,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { STAGE_STEPS } from "@/lib/stages";
import type { AiConfigView, JobView, Mode, ProviderInfo } from "@/lib/types";
import { apiFetch, ClientError, formatBytes, formatClock } from "@/lib/client";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  durationSeconds: number | null;
  previewUrl: string;
};

type YouTubeMeta = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  durationSeconds: number | null;
  hasTranscript: boolean;
  transcriptLanguage: string | null;
  transcriptReason: string | null;
  transcriptPreview: string | null;
  url: string;
};

type ConfigResponse = { config: AiConfigView; providers: ProviderInfo[]; serverKeyAvailable: boolean };

const NICHES = ["Gaming lore", "History mysteries", "Personal finance", "Horror stories", "Tech explainers", "Motivation"];

const DURATIONS: { value: number; label: string }[] = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
];

const MODES: { id: Mode; label: string; blurb: string; icon: typeof Zap }[] = [
  { id: "fast", label: "Fast", blurb: "One focused analysis pass, quick draft. Great with free models.", icon: Zap },
  { id: "balanced", label: "Balanced", blurb: "Storytelling analysis plus a strategy brief before writing.", icon: Gauge },
  { id: "premium", label: "Premium", blurb: "Deep retention read and a more polished draft. Use your strongest model.", icon: BrainCircuit },
];

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const ALLOWED_EXT = ["mp4", "mov", "webm", "m4v"];

function extension(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function uploadWithProgress(file: File, onProgress: (percent: number) => void): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.timeout = 30 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as {
          ok?: boolean;
          file?: UploadedFile;
          error?: { message?: string; hint?: string; code?: string };
        };
        if (xhr.status >= 200 && xhr.status < 300 && data.file) {
          onProgress(100);
          resolve(data.file);
        } else {
          reject(
            new ClientError(data.error?.message || "The upload failed.", {
              hint: data.error?.hint,
              code: data.error?.code,
            }),
          );
        }
      } catch {
        reject(new ClientError("The upload response could not be read."));
      }
    };
    xhr.onerror = () =>
      reject(new ClientError("Upload failed. Check your connection and try again.", { code: "network_error" }));
    xhr.ontimeout = () =>
      reject(new ClientError("The upload timed out.", { hint: "Try a smaller file or a faster connection." }));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function Studio() {
  const router = useRouter();

  const [config, setConfig] = useState<AiConfigView | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [configLoading, setConfigLoading] = useState(true);

  const [niche, setNiche] = useState("");
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<Mode>("balanced");
  const [tab, setTab] = useState<"upload" | "youtube" | "transcript">("upload");

  const [file, setFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<{ message: string; hint?: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [ytUrl, setYtUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<{ message: string; hint?: string } | null>(null);
  const [ytMeta, setYtMeta] = useState<YouTubeMeta | null>(null);

  const [transcript, setTranscript] = useState("");
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<JobView | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const jobPanel = useRef<HTMLDivElement>(null);

  const jobActive = Boolean(job && (job.status === "queued" || job.status === "running"));

  useEffect(() => {
    let active = true;
    apiFetch<ConfigResponse>("/api/config/ai")
      .then((data) => {
        if (!active) return;
        setConfig(data.config);
        setProviders(data.providers);
      })
      .catch((err: ClientError) => {
        if (!active) return;
        if (err.status === 401) router.replace("/verify");
      })
      .finally(() => {
        if (active) setConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  // Remembered defaults from Settings.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hm_prefs");
      if (!raw) return;
      const prefs = JSON.parse(raw) as { duration?: number; mode?: Mode };
      if (prefs.duration && [15, 30, 45, 60, 90].includes(prefs.duration)) setDuration(prefs.duration);
      if (prefs.mode && ["fast", "balanced", "premium"].includes(prefs.mode)) setMode(prefs.mode);
    } catch {
      /* ignore */
    }
    if (new URLSearchParams(window.location.search).get("new")) {
      setFile(null);
      setYtMeta(null);
      setTranscript("");
      setNiche("");
      setJob(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!jobActive) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [jobActive, job?.id]);

  useEffect(() => {
    if (!job || !jobActive) return;
    const jobId = job.id;
    const timer = setInterval(async () => {
      try {
        const data = await apiFetch<{ job: JobView }>(`/api/jobs/${jobId}`);
        setJob(data.job);
        if (data.job.status === "completed" && data.job.scriptId) {
          clearInterval(timer);
          router.push(`/app/scripts/${data.job.scriptId}`);
        } else if (data.job.status === "failed") {
          clearInterval(timer);
        }
      } catch {
        /* transient polling error — keep trying */
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [job?.id, jobActive, router, job]);

  async function handleFile(selected: File | undefined | null) {
    if (!selected) return;
    setUploadError(null);
    if (!ALLOWED_EXT.includes(extension(selected.name))) {
      setUploadError({
        message: `Unsupported format${extension(selected.name) ? ` (.${extension(selected.name)})` : ""}.`,
        hint: "Upload an MP4, MOV, WEBM or M4V file.",
      });
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setUploadError({
        message: `That file is ${formatBytes(selected.size)}. The limit is 200 MB.`,
        hint: "Trim the clip first, then upload.",
      });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadWithProgress(selected, setUploadProgress);
      setFile(uploaded);
      setIsJobErrorDismissed();
    } catch (err) {
      const clientError = err as ClientError;
      setUploadError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function setIsJobErrorDismissed() {
    setJob(null);
    setError(null);
  }

  async function removeFile() {
    if (file) {
      fetch(`/api/files/${file.id}`, { method: "DELETE" }).catch(() => undefined);
    }
    setFile(null);
    setUploadProgress(0);
  }

  async function fetchYouTube() {
    if (!ytUrl.trim()) {
      setYtError({ message: "Paste a YouTube video link first." });
      return;
    }
    setYtLoading(true);
    setYtError(null);
    setYtMeta(null);
    try {
      const data = await apiFetch<{ video: YouTubeMeta }>("/api/youtube/metadata", {
        method: "POST",
        body: JSON.stringify({ url: ytUrl }),
      });
      setYtMeta(data.video);
      if (!data.video.hasTranscript) setShowTranscript(true);
    } catch (err) {
      const clientError = err as ClientError;
      setYtError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setYtLoading(false);
    }
  }

  function validate(): string | null {
    if (niche.trim().length < 2) return "Tell us your niche — even a few words is enough.";
    if (tab === "upload" && !file) return "Upload a reference video, or switch to a YouTube link.";
    if (tab === "youtube" && !ytMeta) return "Fetch a YouTube video before generating.";
    if (tab === "transcript" && transcript.trim().length < 20)
      return "Paste at least a few sentences of the reference transcript.";
    if (tab === "youtube" && !ytMeta?.hasTranscript && transcript.trim().length < 20)
      return "This video has no accessible captions. Paste its transcript to continue.";
    if (!config?.hasKey) return "Connect your AI provider in AI Configuration first.";
    return null;
  }

  async function generate() {
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const payload: Record<string, unknown> = {
        niche: niche.trim(),
        duration,
        mode,
        referenceType: tab,
      };
      if (tab === "upload" && file) {
        payload.fileId = file.id;
        payload.referenceTitle = file.name;
        if (showTranscript && transcript.trim()) payload.transcript = transcript.trim();
      } else if (tab === "youtube" && ytMeta) {
        payload.youtubeUrl = ytUrl.trim();
        payload.referenceTitle = ytMeta.title;
        if (showTranscript && transcript.trim()) payload.transcript = transcript.trim();
      } else {
        payload.transcript = transcript.trim();
        payload.referenceTitle = transcriptTitle.trim() || "Pasted transcript";
      }

      const data = await apiFetch<{ job: JobView }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setJob(data.job);
      setTimeout(() => jobPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (err) {
      const clientError = err as ClientError;
      setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setStarting(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    setCancelling(true);
    try {
      const data = await apiFetch<{ job: JobView }>(`/api/jobs/${job.id}`, { method: "DELETE" });
      setJob(data.job);
    } catch (err) {
      const clientError = err as ClientError;
      setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setCancelling(false);
    }
  }

  const providerLabel = providers.find((p) => p.id === config?.provider)?.label ?? config?.provider ?? "";
  const providerDef = providers.find((p) => p.id === config?.provider);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-400" /> Workspace
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Create Your Next Viral Script
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            Give us your niche and a reference. Let AI handle the creative process.
          </p>
        </div>
        <Link href="/app/scripts" className="btn-secondary btn-sm">
          <FileText className="h-3.5 w-3.5" /> My scripts
        </Link>
      </div>

      {/* Generation panel */}
      {job && (
        <div ref={jobPanel} className="mt-6 scroll-mt-6">
          {job.status === "failed" || job.status === "cancelled" ? (
            <div className="card overflow-hidden border-red-500/25 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-semibold">
                    {job.status === "cancelled" ? "Generation cancelled" : "Generation failed"}
                  </h2>
                  <p className="mt-1 text-[13px] text-white/80">
                    {job.error?.message || (job.status === "cancelled" ? "You stopped this run." : "The run did not finish.")}
                  </p>
                  {job.error?.hint && (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{job.error.hint}</p>
                  )}
                  {job.error?.code && (
                    <p className="mt-2 font-mono text-[10px] text-muted/60">code: {job.error.code}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setJob(null);
                        void generate();
                      }}
                      className="btn-primary btn-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Try again
                    </button>
                    <button onClick={() => setJob(null)} className="btn-secondary btn-sm">
                      Change settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card glow-line overflow-hidden p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="relative mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-lavender-400/30 bg-lavender-400/10 text-lavender-300">
                    <Wand2 className="h-4 w-4" />
                    <span className="absolute inset-0 animate-pulse-ring rounded-xl" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">
                      {job.status === "queued" ? "Queued — starting your run" : "Generating your script"}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {job.mode} mode · {job.duration}s · {providerLabel} {config?.model ? `· ${config.model}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                    <Clock3 className="h-3 w-3" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                  </span>
                  <button onClick={cancelJob} disabled={cancelling} className="btn-ghost btn-sm text-red-300">
                    {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    Cancel
                  </button>
                </div>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lavender-400 to-neon-400 transition-all duration-700"
                  style={{ width: `${Math.max(6, job.progress)}%` }}
                />
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {STAGE_STEPS.map((step) => {
                  const currentIndex = STAGE_STEPS.findIndex((s) => s.stage === job.stage);
                  const stepIndex = STAGE_STEPS.indexOf(step);
                  const done = job.status === "completed" || stepIndex < currentIndex || job.progress >= step.progress;
                  const active = step.stage === job.stage && job.status !== "completed";
                  return (
                    <div
                      key={step.stage}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition ${
                        active
                          ? "border-lavender-400/30 bg-lavender-400/[0.07] text-white"
                          : done
                            ? "border-neon-400/20 bg-neon-400/[0.04] text-white/70"
                            : "border-white/[0.06] text-muted/60"
                      }`}
                    >
                      {done && !active ? (
                        <Check className="h-3.5 w-3.5 text-neon-400" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-lavender-300" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      {step.label}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] text-muted/70">
                Each stage is a real step against your provider. Keep this tab open — cancelling stops the run.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_352px]">
        <div className="space-y-5">
          {/* A — Niche */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-semibold">
                <span className="mr-2 font-mono text-[10px] text-lavender-400">01</span>
                What&apos;s Your Niche?
              </h2>
              <span className="text-[10px] text-muted/60">Required</span>
            </div>
            <div className="mt-4">
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                maxLength={400}
                placeholder="Example: Gaming, History, Finance, Horror Stories, Technology, Motivation..."
                className="input"
                aria-label="Your niche"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {NICHES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setNiche(item)}
                    className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-muted transition hover:border-lavender-400/30 hover:text-lavender-300"
                  >
                    {item}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-muted/50">{niche.length}/400</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
                Long-tail is better: &quot;Finance for 20-somethings who hate budgeting&quot; beats &quot;Finance&quot;.
              </p>
            </div>
          </section>

          {/* B — Reference */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-semibold">
                <span className="mr-2 font-mono text-[10px] text-lavender-400">02</span>
                Add Your Reference Video
              </h2>
              <span className="hidden items-center gap-1 text-[10px] text-muted/60 sm:inline-flex">
                <ShieldCheck className="h-3 w-3" /> used only for analysis
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-ink-950/50 p-1">
              {[
                { id: "upload" as const, label: "Upload", icon: UploadCloud },
                { id: "youtube" as const, label: "YouTube", icon: Youtube },
                { id: "transcript" as const, label: "Transcript", icon: ClipboardPaste },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTab(option.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition ${
                    tab === option.id
                      ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              ))}
            </div>

            {tab === "upload" && (
              <div className="mt-4">
                {!file ? (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      void handleFile(event.dataTransfer.files?.[0]);
                    }}
                    className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-9 text-center transition ${
                      dragging
                        ? "border-lavender-400/60 bg-lavender-400/[0.07]"
                        : "border-white/15 bg-ink-950/40 hover:border-white/25"
                    }`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lavender-300">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                    </span>
                    <p className="mt-3 text-[13px] text-white">
                      {uploading ? `Uploading… ${uploadProgress}%` : "Drop your reference video here or browse files."}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">MP4, MOV, WEBM or M4V · up to 200 MB</p>
                    {uploading ? (
                      <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-lavender-400 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="btn-secondary btn-sm mt-4"
                      >
                        Browse files
                      </button>
                    )}
                    <input
                      ref={fileInput}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
                      className="hidden"
                      onChange={(event) => void handleFile(event.target.files?.[0])}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-ink-950/40 p-3">
                    <div className="overflow-hidden rounded-lg bg-black">
                      <video src={file.previewUrl} controls className="max-h-56 w-full" preload="metadata" />
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-[12px] text-white">
                          <FileVideo className="h-3.5 w-3.5 shrink-0 text-lavender-300" />
                          <span className="truncate">{file.name}</span>
                        </p>
                        <p className="mt-1 text-[10px] text-muted">
                          {formatBytes(file.size)}
                          {file.durationSeconds ? ` · ${formatClock(file.durationSeconds)}` : ""} · uploaded
                        </p>
                      </div>
                      <button type="button" onClick={removeFile} className="btn-ghost btn-sm shrink-0 text-red-300">
                        <X className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5">
                    <p className="text-[12px] text-red-300">{uploadError.message}</p>
                    {uploadError.hint && <p className="mt-0.5 text-[11px] text-red-300/70">{uploadError.hint}</p>}
                  </div>
                )}

                <TranscriptToggle
                  tab={tab}
                  providerDef={providerDef}
                  open={showTranscript}
                  onToggle={() => setShowTranscript((v) => !v)}
                  value={transcript}
                  onChange={setTranscript}
                />
              </div>
            )}

            {tab === "youtube" && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    <input
                      value={ytUrl}
                      onChange={(event) => {
                        setYtUrl(event.target.value);
                        setYtMeta(null);
                        setYtError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void fetchYouTube();
                        }
                      }}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="input pl-10 text-[12px]"
                      aria-label="YouTube video link"
                    />
                  </div>
                  <button onClick={() => void fetchYouTube()} disabled={ytLoading} className="btn-secondary shrink-0">
                    {ytLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {ytLoading ? "Fetching…" : "Fetch video"}
                  </button>
                </div>

                <p className="text-[11px] text-muted/70">
                  We read public metadata and public caption tracks only. Protected videos are never downloaded.
                </p>

                {ytError && (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5">
                    <p className="text-[12px] text-red-300">{ytError.message}</p>
                    {ytError.hint && <p className="mt-0.5 text-[11px] text-red-300/70">{ytError.hint}</p>}
                  </div>
                )}

                {ytMeta && (
                  <div className="rounded-xl border border-white/10 bg-ink-950/40 p-3">
                    <div className="flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ytMeta.thumbnail}
                        alt=""
                        className="h-16 w-28 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[12px] font-medium leading-snug text-white">{ytMeta.title}</p>
                        <p className="mt-1 text-[10px] text-muted">
                          {ytMeta.author || "YouTube"}
                          {ytMeta.durationSeconds ? ` · ${formatClock(ytMeta.durationSeconds)}` : ""}
                        </p>
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${
                            ytMeta.hasTranscript
                              ? "border-neon-400/30 bg-neon-400/[0.06] text-neon-400"
                              : "border-amber-400/30 bg-amber-400/[0.06] text-amber-300"
                          }`}
                        >
                          <AudioLines className="h-2.5 w-2.5" />
                          {ytMeta.hasTranscript
                            ? `Captions ready${ytMeta.transcriptLanguage ? ` · ${ytMeta.transcriptLanguage}` : ""}`
                            : "No captions available"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setYtMeta(null);
                          setYtUrl("");
                        }}
                        className="h-6 shrink-0 rounded-md text-muted hover:text-white"
                        aria-label="Clear reference"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {ytMeta.transcriptPreview && (
                      <p className="mt-2 line-clamp-2 border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-muted/70">
                        {ytMeta.transcriptPreview}…
                      </p>
                    )}
                    {!ytMeta.hasTranscript && (
                      <p className="mt-2 rounded-lg bg-amber-400/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
                        {ytMeta.transcriptReason || "Captions are unavailable."} Paste the transcript below and the
                        analysis will use it.
                      </p>
                    )}
                  </div>
                )}

                <TranscriptToggle
                  tab={tab}
                  providerDef={providerDef}
                  open={showTranscript}
                  onToggle={() => setShowTranscript((v) => !v)}
                  value={transcript}
                  onChange={setTranscript}
                />
              </div>
            )}

            {tab === "transcript" && (
              <div className="mt-4 space-y-3">
                <input
                  value={transcriptTitle}
                  onChange={(event) => setTranscriptTitle(event.target.value)}
                  placeholder="Reference title (optional)"
                  className="input text-[12px]"
                  aria-label="Reference title"
                />
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="Paste the full spoken transcript of the reference video here…"
                  rows={8}
                  className="input min-h-[160px] resize-y text-[12px] leading-relaxed"
                  aria-label="Reference transcript"
                />
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>50+ words gives the analysis enough signal.</span>
                  <span>{transcript.trim() ? transcript.trim().split(/\s+/).length : 0} words</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          {/* C — AI config */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">
                <span className="mr-2 font-mono text-[10px] text-lavender-400">03</span>
                Connect Your AI Brain
              </h2>
              <Link href="/app/config" className="text-[10px] text-lavender-300 hover:underline">
                Configure
              </Link>
            </div>

            {configLoading ? (
              <div className="mt-4 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ) : config?.hasKey ? (
              <div className="mt-4">
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-950/50 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-lavender-400/25 bg-lavender-400/10 text-lavender-300">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white">{providerLabel || config.provider}</p>
                    <p className="truncate font-mono text-[10px] text-muted">{config.model}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-400" />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/70">
                  <Lock className="h-3 w-3" />
                  {config.keyMode === "session" ? "Session-only key (12h)" : "Key encrypted at rest"}
                  {providerDef?.supportsTranscription ? " · audio transcription ready" : " · transcript needed for uploads"}
                </p>
                <Link href="/app/config" className="btn-secondary btn-sm mt-3 w-full">
                  <Gauge className="h-3.5 w-3.5" /> Change provider or model
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" /> No AI key connected
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                  Add your provider key and pick a model — HookMerge uses your key for every analysis and
                  generation call.
                </p>
                <Link href="/app/config" className="btn-primary btn-sm mt-3 w-full">
                  Connect AI provider <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </section>

          {/* D — Length + mode */}
          <section className="card p-5">
            <h2 className="font-display text-sm font-semibold">
              <span className="mr-2 font-mono text-[10px] text-lavender-400">04</span>
              Script Length & Quality
            </h2>

            <div className="mt-4">
              <p className="label">Video duration</p>
              <div className="grid grid-cols-5 gap-1.5">
                {DURATIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDuration(option.value)}
                    className={`rounded-lg border px-1 py-2 text-[11px] font-medium transition ${
                      duration === option.value
                        ? "border-lavender-400/50 bg-lavender-400/[0.12] text-white"
                        : "border-white/[0.08] text-muted hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="label">Processing mode</p>
              <div className="space-y-1.5">
                {MODES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                      mode === option.id
                        ? "border-lavender-400/40 bg-lavender-400/[0.08]"
                        : "border-white/[0.07] hover:border-white/15"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                        mode === option.id ? "bg-lavender-400/15 text-lavender-300" : "bg-white/[0.04] text-muted"
                      }`}
                    >
                      <option.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-white">{option.label}</span>
                      <span className="block text-[10px] leading-snug text-muted">{option.blurb}</span>
                    </span>
                    {mode === option.id && <Check className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-lavender-300" />}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted/60">
                Mode changes how deep the analysis goes — actual quality comes from the model you chose.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5">
                <p className="text-[12px] text-red-300">{error.message}</p>
                {error.hint && <p className="mt-0.5 text-[11px] text-red-300/70">{error.hint}</p>}
              </div>
            )}

            <button
              onClick={() => void generate()}
              disabled={starting || jobActive || configLoading}
              className="btn-primary mt-4 w-full"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : jobActive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate My Script
                </>
              )}
            </button>

            <div className="mt-3 flex items-center justify-between text-[10px] text-muted/60">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" /> ~{mode === "fast" ? "20–40s" : mode === "balanced" ? "40–70s" : "60–120s"}
              </span>
              <Link href="/app/config" className="inline-flex items-center gap-1 hover:text-lavender-300">
                <Plus className="h-3 w-3" /> New provider
              </Link>
            </div>
          </section>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted/70">
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-lavender-400" />
              Your provider bills your key directly. HookMerge never sees or resells your AI capacity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TranscriptToggle({
  tab,
  providerDef,
  open,
  onToggle,
  value,
  onChange,
}: {
  tab: "upload" | "youtube" | "transcript";
  providerDef?: ProviderInfo;
  open: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
}) {
  if (tab === "transcript") return null;
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-ink-950/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <ClipboardPaste className="h-3.5 w-3.5" />
          {tab === "upload" ? "Paste the transcript instead (skip transcription)" : "Paste a transcript as fallback"}
        </span>
        <span className={`text-[10px] text-lavender-300 transition ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-3.5 py-3">
          {providerDef && !providerDef.supportsTranscription && tab === "upload" && (
            <p className="mb-2 rounded-lg bg-amber-400/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
              {providerDef.label} can&apos;t transcribe audio. Paste the transcript here, or connect OpenAI, Groq
              or Gemini.
            </p>
          )}
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            placeholder="Paste the spoken transcript here…"
            className="input resize-y text-[12px] leading-relaxed"
            aria-label="Transcript override"
          />
          <p className="mt-1.5 text-[10px] text-muted/60">
            {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Optional — especially useful for silent or music-only clips."}
          </p>
        </div>
      )}
    </div>
  );
}
