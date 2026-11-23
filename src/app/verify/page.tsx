"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/logo";

type ApiFailure = { error?: { code?: string; message?: string; hint?: string } };

export default function VerifyPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/license/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { authenticated?: boolean }) => {
        if (active) setHasSession(Boolean(data.authenticated));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim()) {
      setError({ message: "Enter your license key to continue." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as ApiFailure;
      if (!res.ok) {
        setError({
          message: data.error?.message || "That license key isn't valid.",
          hint: data.error?.hint,
        });
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError({
        message: "We couldn't reach the server.",
        hint: "Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-lavender-500/15 blur-[130px]" />

      <header className="relative z-10 container-page flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="font-display text-[17px] font-semibold">
            HookMerge <span className="text-lavender-400">AI</span>
          </span>
        </Link>
        <Link href="/contact" className="text-xs text-muted transition hover:text-white">
          Need a license?
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-20">
        <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div className="hidden lg:block">
            <span className="chip border-lavender-400/30 text-lavender-300">
              <Lock className="h-3 w-3" /> Licensed access only
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight">
              Your studio is <span className="grad-text">one key away.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              HookMerge AI is a private workspace. Verify the license you were issued to unlock the
              dashboard, your saved scripts and the generation engine.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: ShieldCheck,
                  title: "Verified on the server",
                  body: "Keys are hashed, never stored in plain text, and checked on every protected API call.",
                },
                {
                  icon: KeyRound,
                  title: "Session, not localStorage",
                  body: "You get a signed HttpOnly session that expires after seven days.",
                },
                {
                  icon: BadgeCheck,
                  title: "Revocable and expirable",
                  body: "Operators can revoke, expire or limit any license instantly from the admin console.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-lavender-300">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-white">{item.title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass w-full rounded-3xl p-6 shadow-glow sm:p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-lavender-400/25 bg-lavender-400/10 text-lavender-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <span className="chip">Step 1 of 4</span>
            </div>

            <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
              Verify your license
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Paste the key you were issued. It looks like{" "}
              <span className="font-mono text-[11px] text-white/80">HM-XXXXX-XXXXX-…</span>
            </p>

            {checkingSession ? (
              <div className="mt-8 flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for an existing session…
              </div>
            ) : hasSession ? (
              <div className="mt-6 rounded-xl border border-neon-400/25 bg-neon-400/[0.07] p-4">
                <p className="flex items-center gap-2 text-[13px] font-medium text-neon-400">
                  <BadgeCheck className="h-4 w-4" /> Your session is already active
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Continue to your workspace, or verify a different key below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    router.replace("/app");
                    router.refresh();
                  }}
                  className="btn-primary mt-4 w-full"
                >
                  Continue to dashboard <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="license-key" className="label">
                  License key
                </label>
                <div className="relative">
                  <input
                    id="license-key"
                    type={reveal ? "text" : "password"}
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      if (error) setError(null);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="HM-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XX"
                    className="input pr-11 font-mono text-[13px] tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-white"
                    aria-label={reveal ? "Hide key" : "Show key"}
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3"
                >
                  <p className="text-[12px] font-medium text-red-300">{error.message}</p>
                  {error.hint && <p className="mt-1 text-[11px] leading-relaxed text-red-300/70">{error.hint}</p>}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Verify License
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.07] pt-4 text-[11px] text-muted">
              <p>
                Keys are case-insensitive. Lost your key?{" "}
                <Link href="/contact" className="text-lavender-300 underline-offset-4 hover:underline">
                  Contact us
                </Link>
                .
              </p>
              <p>
                Operator?{" "}
                <Link href="/admin" className="text-muted underline-offset-4 hover:text-white hover:underline">
                  Admin console
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 container-page flex flex-col gap-2 border-t border-white/[0.06] py-6 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} HookMerge AI</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/" className="hover:text-white">
            Back to site
          </Link>
        </div>
      </footer>
    </div>
  );
}
