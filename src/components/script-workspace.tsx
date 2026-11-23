"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  Gauge,
  Lightbulb,
  Loader2,
  Lock,
  Maximize2,
  Pencil,
  Quote,
  RefreshCw,
  Scissors,
  Sparkles,
  Target,
  Trash2,
  Wand2,
} from "lucide-react";
import type { Analysis, ScriptRecord } from "@/lib/types";
import {
  apiFetch,
  ClientError,
  copyToClipboard,
  downloadText,
  formatDateTime,
  slugify,
} from "@/lib/client";

const ACTIONS = [
  { id: "regenerate", label: "Regenerate Script", icon: RefreshCw },
  { id: "new_version", label: "Generate Another Version", icon: Sparkles },
  { id: "improve_hook", label: "Improve Hook", icon: Wand2 },
  { id: "more_engaging", label: "Make Script More Engaging", icon: Gauge },
  { id: "shorten", label: "Shorten Script", icon: Scissors },
  { id: "expand", label: "Expand Script", icon: Maximize2 },
] as const;

const ANALYSIS_FIELDS: { key: keyof Analysis; label: string }[] = [
  { key: "first_three_seconds", label: "First three seconds" },
  { key: "storytelling_format", label: "Storytelling format" },
  { key: "central_idea", label: "Central idea" },
  { key: "dialogue_style", label: "Dialogue style" },
  { key: "sentence_length", label: "Sentence length" },
  { key: "pacing", label: "Pacing" },
  { key: "transitions", label: "Transitions" },
  { key: "information_delivery", label: "Information delivery" },
  { key: "ending_payoff", label: "Ending & payoff" },
  { key: "approx_script_length", label: "Reference length" },
];

type AnalysisListKey = "emotional_triggers" | "curiosity_gaps" | "retention_techniques" | "why_it_works";

const ANALYSIS_LISTS: { key: AnalysisListKey; label: string }[] = [
  { key: "emotional_triggers", label: "Emotional triggers" },
  { key: "curiosity_gaps", label: "Curiosity gaps" },
  { key: "retention_techniques", label: "Retention techniques" },
  { key: "why_it_works", label: "Why it works" },
];

export function ScriptWorkspace({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [script, setScript] = useState<ScriptRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ message: string; hint?: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setEditing(false);
    apiFetch<{ script: ScriptRecord }>(`/api/scripts/${scriptId}`)
      .then((data) => {
        if (!active) return;
        setScript(data.script);
        setDraftTitle(data.script.title);
        setDraftBody(data.script.body);
      })
      .catch((err: ClientError) => {
        if (!active) return;
        setError({ message: err.message, hint: err.hint });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scriptId]);

  const words = useMemo(() => {
    if (!script) return 0;
    return script.body.trim().split(/\s+/).filter(Boolean).length;
  }, [script]);

  async function handleCopy() {
    if (!script) return;
    const ok = await copyToClipboard(script.body);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  function handleDownload() {
    if (!script) return;
    const content = [
      script.title,
      "",
      `Niche: ${script.niche}`,
      `Duration: ${script.duration}s · Mode: ${script.mode} · Model: ${script.provider}/${script.model}`,
      "",
      "HOOK",
      script.hook,
      "",
      "SCRIPT",
      script.body,
      "",
      script.referenceTitle ? `Reference: ${script.referenceTitle}` : "",
      script.referenceSource ? `Source: ${script.referenceSource}` : "",
    ]
      .filter((line) => line !== undefined)
      .join("\n");
    downloadText(`${slugify(script.title)}.txt`, content);
  }

  async function runAction(action: string) {
    setActionLoading(action);
    setActionError(null);
    try {
      const data = await apiFetch<{ script: ScriptRecord }>(`/api/scripts/${scriptId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      router.push(`/app/scripts/${data.script.id}`);
      router.refresh();
    } catch (err) {
      const clientError = err as ClientError;
      setActionError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setActionLoading(null);
    }
  }

  async function saveEdits() {
    if (!script) return;
    if (!draftBody.trim()) {
      setActionError({ message: "The script can't be empty." });
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const data = await apiFetch<{ script: ScriptRecord }>(`/api/scripts/${script.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: draftTitle.trim() || script.title, body: draftBody }),
      });
      setScript(data.script);
      setEditing(false);
    } catch (err) {
      const clientError = err as ClientError;
      setActionError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setSaving(false);
    }
  }

  async function deleteScript() {
    if (!script) return;
    if (!window.confirm("Delete this script permanently? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/scripts/${script.id}`, { method: "DELETE" });
      router.push("/app/scripts");
      router.refresh();
    } catch (err) {
      const clientError = err as ClientError;
      setActionError({ message: clientError.message, hint: clientError.hint });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-9 w-2/3" />
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="skeleton h-36 w-full rounded-2xl" />
            <div className="skeleton h-72 w-full rounded-2xl" />
          </div>
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="mt-5 font-display text-xl font-semibold">Script unavailable</h1>
        <p className="mt-2 text-sm text-muted">{error?.message || "That script could not be found."}</p>
        {error?.hint && <p className="mt-1 text-xs text-muted/70">{error.hint}</p>}
        <Link href="/app/scripts" className="btn-secondary mt-6">
          Back to my scripts
        </Link>
      </div>
    );
  }

  const analysis = script.analysis;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/scripts" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> My scripts
        </Link>
        <Link href="/app" className="btn-ghost btn-sm">
          <Sparkles className="h-3.5 w-3.5" /> New script
        </Link>
      </div>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-active capitalize">{script.mode} mode</span>
          <span className="chip">
            <Clock3 className="h-3 w-3" /> {script.duration}s
          </span>
          <span className="chip">
            <AudioLines className="h-3 w-3" /> {words} words
          </span>
          <span className="chip">
            <Lock className="h-3 w-3" /> {script.provider} · {script.model}
          </span>
          {script.parentId && <span className="chip">Revision</span>}
        </div>
        {editing ? (
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="input mt-4 font-display text-lg font-semibold"
            aria-label="Script title"
          />
        ) : (
          <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {script.title}
          </h1>
        )}
        <p className="mt-2 text-[12px] text-muted">
          Niche: <span className="text-white/80">{script.niche}</span> · Created {formatDateTime(script.createdAt)}
          {script.generationMs ? ` · generated in ${(script.generationMs / 1000).toFixed(1)}s` : ""}
        </p>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Hook */}
          <section className="relative overflow-hidden rounded-2xl border border-lavender-400/25 bg-gradient-to-br from-lavender-400/[0.1] via-ink-900/60 to-ink-900/60 p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lavender-500/20 blur-3xl" />
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-lavender-300">
                <Quote className="h-3 w-3" /> Opening hook
              </p>
              <button
                onClick={() => void runAction("improve_hook")}
                disabled={actionLoading !== null}
                className="text-[10px] text-lavender-300 hover:underline disabled:opacity-50"
              >
                {actionLoading === "improve_hook" ? "Rewriting…" : "Improve hook"}
              </button>
            </div>
            <p className="relative mt-3 font-display text-lg leading-snug text-white sm:text-xl">{script.hook}</p>
          </section>

          {/* Script */}
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                <FileText className="h-4 w-4 text-lavender-300" /> Complete script
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => void handleCopy()} className="btn-secondary btn-sm">
                  {copied ? <Check className="h-3.5 w-3.5 text-neon-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button onClick={handleDownload} className="btn-secondary btn-sm">
                  <Download className="h-3.5 w-3.5" /> TXT
                </button>
                {editing ? (
                  <>
                    <button onClick={() => void saveEdits()} disabled={saving} className="btn-primary btn-sm">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setDraftTitle(script.title);
                        setDraftBody(script.body);
                      }}
                      className="btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>

            {actionError && (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5">
                <p className="text-[12px] text-red-300">{actionError.message}</p>
                {actionError.hint && <p className="mt-0.5 text-[11px] text-red-300/70">{actionError.hint}</p>}
              </div>
            )}

            {editing ? (
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={20}
                className="input mt-4 min-h-[380px] resize-y text-[14px] leading-7"
                aria-label="Script body"
              />
            ) : (
              <div className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-white/85">{script.body}</div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-muted">
              <span>{words} words · ~{Math.round((words / 2.4) * 10) / 10}s spoken</span>
              <span>Review before publishing — AI drafts are starting points.</span>
            </div>
          </section>

          {/* Structure */}
          {script.structure && (
            <section className="card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                <Target className="h-4 w-4 text-neon-400" /> Script structure
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ["Opening", script.structure.opening],
                  ["Setup", script.structure.setup],
                  ["Main development", script.structure.development],
                  ["Curiosity / retention", script.structure.retention],
                  ["Ending / payoff", script.structure.ending],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.07] bg-ink-950/40 p-3.5 last:sm:col-span-2"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-white/80">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Analysis */}
          {analysis && (
            <section className="card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <BrainCircuit className="h-4 w-4 text-lavender-300" /> Reference video analysis
                </h2>
                <span className="chip">15 signals</span>
              </div>

              {analysis.opening_hook && (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-lavender-300">
                    Opening hook mechanic
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/80">{analysis.opening_hook}</p>
                </div>
              )}

              {analysis.narrative_structure.length > 0 && (
                <div className="mt-4">
                  <p className="label">Narrative beats</p>
                  <div className="space-y-1.5">
                    {analysis.narrative_structure.map((beat, index) => (
                      <div
                        key={`${beat.beat}-${index}`}
                        className="flex gap-3 rounded-lg border border-white/[0.06] bg-ink-950/30 px-3 py-2"
                      >
                        <span className="mt-0.5 font-mono text-[10px] text-lavender-400/80">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-[11px] font-medium text-white/90">{beat.beat}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{beat.purpose}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ANALYSIS_FIELDS.map((field) => {
                  const value = analysis[field.key];
                  if (typeof value !== "string" || !value) return null;
                  return (
                    <div key={field.key} className="rounded-xl border border-white/[0.06] bg-ink-950/30 p-3.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{field.label}</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/75">{value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ANALYSIS_LISTS.map((field) => {
                  const value = analysis[field.key];
                  if (!Array.isArray(value) || value.length === 0) return null;
                  return (
                    <div key={field.key} className="rounded-xl border border-white/[0.06] bg-ink-950/30 p-3.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{field.label}</p>
                      <ul className="mt-2 space-y-1.5">
                        {value.map((item, index) => (
                          <li key={index} className="flex gap-2 text-[11px] leading-relaxed text-white/75">
                            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-lavender-400/70" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {analysis.reusable_formula && (
                <div className="mt-4 rounded-xl border border-neon-400/20 bg-neon-400/[0.05] p-3.5">
                  <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neon-400">
                    <Lightbulb className="h-3 w-3" /> Reusable formula
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/80">{analysis.reusable_formula}</p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="card p-5">
            <h2 className="font-display text-sm font-semibold">Refine this script</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Each action runs a real model call and saves a new version — your original stays intact.
            </p>
            <div className="mt-4 space-y-1.5">
              {ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => void runAction(action.id)}
                  disabled={actionLoading !== null || editing}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] px-3 py-2.5 text-left text-[12px] text-white/85 transition hover:border-lavender-400/30 hover:bg-lavender-400/[0.05] disabled:opacity-50"
                >
                  {actionLoading === action.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-lavender-300" />
                  ) : (
                    <action.icon className="h-3.5 w-3.5 text-lavender-300" />
                  )}
                  <span className="flex-1">{action.label}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted/50" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted/60">
              Actions use your provider key and count toward your license usage.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-sm font-semibold">Generation details</h2>
            <dl className="mt-3 space-y-2.5 text-[11px]">
              {[
                ["Provider", script.provider],
                ["Model", script.model],
                ["Mode", script.mode],
                ["Duration", `${script.duration}s`],
                ["Generation time", script.generationMs ? `${(script.generationMs / 1000).toFixed(1)}s` : "—"],
                ["Created", formatDateTime(script.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="max-w-[60%] break-words text-right text-white/85">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-sm font-semibold">Reference</h2>
            <p className="mt-2 text-[12px] text-white/80">{script.referenceTitle || "—"}</p>
            <p className="mt-1 text-[10px] text-muted">{script.referenceSource || "Manual transcript"}</p>
            <div className="mt-4 space-y-1.5">
              <button onClick={() => void handleCopy()} className="btn-secondary btn-sm w-full">
                <Copy className="h-3.5 w-3.5" /> Copy script
              </button>
              <button onClick={handleDownload} className="btn-secondary btn-sm w-full">
                <Download className="h-3.5 w-3.5" /> Download TXT
              </button>
              <button onClick={() => void deleteScript()} disabled={deleting} className="btn-danger btn-sm w-full">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete script
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
