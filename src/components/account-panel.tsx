"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { LicenseView } from "@/lib/types";
import { apiFetch, ClientError, formatDate } from "@/lib/client";

type SessionResponse = {
  authenticated: boolean;
  license: LicenseView | null;
  usage?: { scripts: number; expired: boolean; exhausted: boolean };
  aiConfigured?: boolean;
};

export function AccountPanel() {
  const router = useRouter();
  const [data, setData] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<SessionResponse>("/api/license/session")
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: ClientError) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setWorking(true);
    try {
      await fetch("/api/license/session", { method: "DELETE" });
      router.replace("/verify");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-5 text-[12px] text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data.authenticated || !data.license) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-xl font-semibold">Session ended</h1>
        <p className="mt-2 text-sm text-muted">Verify your license to reopen the workspace.</p>
        <Link href="/verify" className="btn-primary mt-5">
          Verify license
        </Link>
      </div>
    );
  }

  const license = data.license;
  const expired = license.expiresAt ? license.expiresAt <= Date.now() : false;
  const limit = license.generationLimit && license.generationLimit > 0 ? license.generationLimit : null;
  const percent = limit ? Math.min(100, Math.round((license.generationsUsed / limit) * 100)) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Account</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Account / License</h1>
          <p className="mt-2 text-[13px] text-muted">Your access, usage and session security.</p>
        </div>
        <button onClick={() => void logout()} disabled={working} className="btn-secondary btn-sm">
          {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Logout
        </button>
      </div>

      {expired && (
        <div className="mt-5 flex gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-[12px] text-red-300">
            This license has expired. New generations are blocked — contact support to renew.
          </p>
        </div>
      )}

      <section className="card mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lavender-400/25 bg-lavender-400/10 text-lavender-300">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold">{license.label || "Licensed workspace"}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{license.keyPrefix}••••••••••••</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
              expired || license.status === "revoked"
                ? "border-red-500/30 bg-red-500/[0.06] text-red-300"
                : "border-neon-400/30 bg-neon-400/[0.06] text-neon-400"
            }`}
          >
            {expired ? "Expired" : license.status === "revoked" ? "Revoked" : "Active"}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Activated", value: license.activatedAt ? formatDate(license.activatedAt) : "—", icon: BadgeCheck },
            {
              label: "Expires",
              value: license.expiresAt ? formatDate(license.expiresAt) : "Never",
              icon: CalendarClock,
            },
            { label: "Scripts saved", value: String(data.usage?.scripts ?? 0), icon: FileText },
            {
              label: "Generations used",
              value: limit ? `${license.generationsUsed} of ${limit}` : String(license.generationsUsed),
              icon: RefreshCw,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.06] bg-ink-950/40 p-3.5">
              <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
                <item.icon className="h-3 w-3" /> {item.label}
              </dt>
              <dd className="mt-1.5 text-[13px] text-white">{item.value}</dd>
            </div>
          ))}
        </dl>

        {percent !== null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>License usage</span>
              <span>{percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={`h-full rounded-full ${percent >= 90 ? "bg-red-400" : "bg-lavender-400"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-neon-400" /> Session security
          </h2>
          <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-neon-400" />
              Signed HttpOnly session cookie, seven-day expiry.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-neon-400" />
              Every protected API call re-checks license status and expiry on the server.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-neon-400" />
              The full key is never stored — only a salted hash and a display prefix.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-neon-400" />
              Logging out clears the session record immediately.
            </li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-lavender-300" /> Workspace access
          </h2>
          <div className="mt-3 space-y-2 text-[11px] text-muted">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2">
              <span>AI provider</span>
              <span className={data.aiConfigured ? "text-neon-400" : "text-amber-300"}>
                {data.aiConfigured ? "Connected" : "Not connected"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2">
              <span>Generation limit</span>
              <span>{limit ? `${limit} total` : "Unlimited"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Link href="/app/config" className="btn-secondary btn-sm w-full">
              Manage AI configuration
            </Link>
            <button onClick={() => void logout()} className="btn-ghost btn-sm w-full">
              Switch license key
            </button>
          </div>
        </section>
      </div>

      <p className="mt-5 text-[10px] leading-relaxed text-muted/60">
        Need a longer license, more generations or a second seat? Contact support with your license prefix — never
        send your full key or API key.
      </p>
    </div>
  );
}
