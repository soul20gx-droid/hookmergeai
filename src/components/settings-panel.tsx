"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import type { Mode } from "@/lib/types";

type Prefs = { duration: number; mode: Mode };

const DEFAULT_PREFS: Prefs = { duration: 30, mode: "balanced" };

export function SettingsPanel() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("hm_prefs");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({
          duration: [15, 30, 45, 60, 90].includes(Number(parsed.duration)) ? Number(parsed.duration) : 30,
          mode: ["fast", "balanced", "premium"].includes(String(parsed.mode)) ? (parsed.mode as Mode) : "balanced",
        });
      }
    } catch {
      /* ignore corrupt prefs */
    }
  }, []);

  function save() {
    localStorage.setItem("hm_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function reset() {
    localStorage.removeItem("hm_prefs");
    setPrefs(DEFAULT_PREFS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Settings</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Workspace settings</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Defaults for new generations. These are stored in this browser only — license access is always
          server-side.
        </p>
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-lavender-300" /> Generation defaults
        </h2>

        <div className="mt-4">
          <p className="label">Default video duration</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[15, 30, 45, 60, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPrefs((prev) => ({ ...prev, duration: value }))}
                className={`rounded-lg border py-2 text-[11px] font-medium transition ${
                  prefs.duration === value
                    ? "border-lavender-400/50 bg-lavender-400/[0.12] text-white"
                    : "border-white/[0.08] text-muted hover:text-white"
                }`}
              >
                {value}s
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="label">Default processing mode</p>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {(
              [
                ["fast", "Fast"],
                ["balanced", "Balanced"],
                ["premium", "Premium"],
              ] as [Mode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPrefs((prev) => ({ ...prev, mode: value }))}
                className={`rounded-lg border py-2 text-[11px] font-medium capitalize transition ${
                  prefs.mode === value
                    ? "border-lavender-400/50 bg-lavender-400/[0.12] text-white"
                    : "border-white/[0.08] text-muted hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={save} className="btn-primary btn-sm">
            {saved ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {saved ? "Saved" : "Save preferences"}
          </button>
          <button onClick={reset} className="btn-secondary btn-sm">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </button>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/app/config" className="card p-4 transition hover:border-lavender-400/25">
          <p className="text-[12px] font-medium text-white">AI configuration</p>
          <p className="mt-1 text-[11px] text-muted">Provider, model, key storage and connection tests.</p>
        </Link>
        <Link href="/app/account" className="card p-4 transition hover:border-lavender-400/25">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-white">
            <ShieldCheck className="h-3.5 w-3.5 text-neon-400" /> Account & license
          </p>
          <p className="mt-1 text-[11px] text-muted">Usage, expiry, session security and logout.</p>
        </Link>
      </section>
    </div>
  );
}
