"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  FileText,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "./logo";
import type { LicenseView } from "@/lib/types";
import { formatDate } from "@/lib/client";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app?new=1", label: "Create New Script", icon: Plus },
  { href: "/app/scripts", label: "My Scripts", icon: FileText },
  { href: "/app/config", label: "AI Configuration", icon: KeyRound },
  { href: "/app/account", label: "Account / License", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function daysLeft(expiresAt: number | null) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function AppSidebar({ license }: { license: LicenseView }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const remaining = daysLeft(license.expiresAt);
  const usage =
    license.generationLimit && license.generationLimit > 0
      ? `${license.generationsUsed}/${license.generationLimit}`
      : `${license.generationsUsed}`;

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/license/session", { method: "DELETE" });
    } finally {
      router.replace("/verify");
      router.refresh();
    }
  }

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/app" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <button
          className="text-muted hover:text-white lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          // Query-string links ("Create New Script") are actions, not pages.
          const active = !item.href.includes("?") && pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
              License
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-neon-400">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-400" /> Active
            </span>
          </div>
          <p className="mt-2 truncate font-mono text-[11px] text-white">{license.keyPrefix}••••••</p>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
            <span>{remaining === null ? "No expiry" : `${remaining} days left`}</span>
            <span>{usage} scripts</span>
          </div>
          {license.expiresAt && (
            <p className="mt-1 text-[10px] text-muted/70">Expires {formatDate(license.expiresAt)}</p>
          )}
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Logout
        </button>

        <Link
          href="/app/config"
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] text-muted/60 transition hover:text-lavender-300"
        >
          <Sparkles className="h-3 w-3" /> Bring your own AI key
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.07] bg-ink-950/85 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/app" className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-sm font-semibold">HookMerge AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="chip border-neon-400/25 text-neon-400">
            <BadgeCheck className="h-3 w-3" /> Active
          </span>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-white/10 p-2 text-muted hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.07] bg-ink-900/40 lg:sticky lg:top-0 lg:block lg:h-screen">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] border-r border-white/10 bg-ink-900 shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
