"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ScriptSummary } from "@/lib/types";
import { apiFetch, ClientError, copyToClipboard, timeAgo } from "@/lib/client";

export function ScriptsLibrary() {
  const router = useRouter();
  const [scripts, setScripts] = useState<ScriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ scripts: ScriptSummary[] }>("/api/scripts")
      .then((data) => {
        if (active) setScripts(data.scripts);
      })
      .catch((err: ClientError) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter(
      (script) =>
        script.title.toLowerCase().includes(q) ||
        script.niche.toLowerCase().includes(q) ||
        script.model.toLowerCase().includes(q),
    );
  }, [scripts, query]);

  async function rename(id: string) {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return;
    setBusy(id);
    try {
      const data = await apiFetch<{ script: { id: string; title: string; updatedAt: number } }>(
        `/api/scripts/${id}`,
        { method: "PATCH", body: JSON.stringify({ title }) },
      );
      setScripts((prev) =>
        prev.map((script) =>
          script.id === id ? { ...script, title: data.script.title, updatedAt: data.script.updatedAt } : script,
        ),
      );
      setEditing(null);
    } catch (err) {
      setError((err as ClientError).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this script permanently?")) return;
    setBusy(id);
    try {
      await apiFetch(`/api/scripts/${id}`, { method: "DELETE" });
      setScripts((prev) => prev.filter((script) => script.id !== id));
    } catch (err) {
      setError((err as ClientError).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyScript(id: string) {
    setBusy(id);
    try {
      const data = await apiFetch<{ script: { body: string } }>(`/api/scripts/${id}`);
      const ok = await copyToClipboard(data.script.body);
      if (ok) {
        setCopied(id);
        setTimeout(() => setCopied(null), 1800);
      }
    } catch (err) {
      setError((err as ClientError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Library</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">My Scripts</h1>
          <p className="mt-2 text-[13px] text-muted">
            {loading ? "Loading…" : `${scripts.length} saved script${scripts.length === 1 ? "" : "s"} on this license.`}
          </p>
        </div>
        <Link href="/app" className="btn-primary btn-sm">
          <Sparkles className="h-3.5 w-3.5" /> New script
        </Link>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, niche or model…"
          className="input pl-10 text-[12px]"
          aria-label="Search scripts"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-[12px] text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 card flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lavender-300">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-display text-base font-semibold">
            {scripts.length === 0 ? "No scripts yet" : "Nothing matches that search"}
          </h2>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
            {scripts.length === 0
              ? "Add a niche and a reference video, then generate your first script. It will be saved here automatically."
              : "Try a different title, niche or model name."}
          </p>
          {scripts.length === 0 && (
            <Link href="/app" className="btn-primary mt-5 btn-sm">
              Create your first script <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((script) => (
            <article
              key={script.id}
              className="card group p-4 transition hover:border-white/15 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editing?.id === script.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editing.title}
                        onChange={(event) => setEditing({ id: script.id, title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void rename(script.id);
                          if (event.key === "Escape") setEditing(null);
                        }}
                        autoFocus
                        className="input input-sm flex-1"
                        aria-label="Script title"
                      />
                      <button
                        onClick={() => void rename(script.id)}
                        disabled={busy === script.id}
                        className="btn-primary btn-sm"
                      >
                        {busy === script.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </button>
                      <button onClick={() => setEditing(null)} className="btn-ghost btn-sm">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/app/scripts/${script.id}`}
                      className="font-display text-[15px] font-semibold leading-snug text-white hover:text-lavender-300"
                    >
                      {script.title}
                    </Link>
                  )}
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">{script.hook}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                    <span className="chip capitalize">{script.mode}</span>
                    <span className="chip">
                      <Clock3 className="h-2.5 w-2.5" /> {script.duration}s
                    </span>
                    <span className="chip">{script.niche}</span>
                    <span className="text-muted/60">
                      {script.provider} · {script.model} · {timeAgo(script.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing({ id: script.id, title: script.title })}
                    className="btn-ghost btn-sm"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void copyScript(script.id)}
                    disabled={busy === script.id}
                    className="btn-ghost btn-sm"
                    title="Copy script"
                  >
                    {copied === script.id ? (
                      <Check className="h-3.5 w-3.5 text-neon-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => void remove(script.id)}
                    disabled={busy === script.id}
                    className="btn-ghost btn-sm text-red-300 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => router.push(`/app/scripts/${script.id}`)}
                    className="btn-secondary btn-sm ml-1"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
