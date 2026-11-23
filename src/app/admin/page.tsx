"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  FileText,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import type { AdminLicenseRow, AdminStats } from "@/lib/types";
import { apiFetch, ClientError, copyToClipboard, formatDate, formatDateTime } from "@/lib/client";

type Tab = "overview" | "licenses" | "settings";

type SettingsMap = {
  license_generation_limit_default: number;
  license_validity_days_default: number;
  max_upload_mb: number;
};

const EMPTY_FORM = { label: "", quantity: 1, expiresInDays: 0, generationLimit: 0, notes: "" };

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<{ message: string; hint?: string } | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [licenses, setLicenses] = useState<AdminLicenseRow[]>([]);
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<{ id: string; key: string }[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [selected, setSelected] = useState<AdminLicenseRow | null>(null);
  const [manage, setManage] = useState({ label: "", expiresInDays: 0, generationLimit: 0, notes: "" });
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const data = await apiFetch<{ stats: AdminStats }>("/api/admin/stats");
    setStats(data.stats);
  }, []);

  const loadLicenses = useCallback(async (query = "") => {
    const data = await apiFetch<{ licenses: AdminLicenseRow[] }>(
      `/api/admin/licenses${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
    setLicenses(data.licenses);
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await apiFetch<{ settings: SettingsMap }>("/api/admin/settings");
    setSettings(data.settings);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStats(), loadLicenses(), loadSettings()]);
    } catch (err) {
      const clientError = err as ClientError;
      if (clientError.status === 401) setAuthed(false);
      else setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadLicenses, loadSettings]);

  useEffect(() => {
    let active = true;
    apiFetch<{ authenticated: boolean }>("/api/admin/session")
      .then((data) => {
        if (!active) return;
        setAuthed(data.authenticated);
        if (data.authenticated) void loadAll();
      })
      .catch(() => {
        if (active) setAuthed(false);
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  useEffect(() => {
    if (authed !== true) return;
    const timer = setTimeout(() => {
      void loadLicenses(search).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, authed, loadLicenses]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setLoginError({ message: "Enter the admin password." });
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    try {
      await apiFetch("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });
      setAuthed(true);
      setPassword("");
      await loadAll();
    } catch (err) {
      const clientError = err as ClientError;
      setLoginError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setStats(null);
    setLicenses([]);
  }

  async function createLicenses(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const data = await apiFetch<{ created: { id: string; key: string }[] }>("/api/admin/licenses", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreatedKeys(data.created);
      setForm({ ...EMPTY_FORM });
      await Promise.all([loadLicenses(search), loadStats()]);
    } catch (err) {
      const clientError = err as ClientError;
      setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setCreating(false);
    }
  }

  async function patchLicense(id: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/licenses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await Promise.all([loadLicenses(search), loadStats()]);
      after?.();
    } catch (err) {
      const clientError = err as ClientError;
      setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setBusy(false);
    }
  }

  async function saveManage() {
    if (!selected) return;
    await patchLicense(
      selected.id,
      {
        label: manage.label,
        expiresInDays: manage.expiresInDays,
        clearExpiry: manage.expiresInDays === 0,
        generationLimit: manage.generationLimit,
        notes: manage.notes,
      },
      () => setSelected(null),
    );
  }

  async function removeLicense(license: AdminLicenseRow) {
    if (!window.confirm(`Delete license ${license.keyPrefix}… and detach it? This cannot be undone.`)) return;
    await patchLicense(license.id, { action: "delete" }, () => setSelected(null));
  }

  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ settings: SettingsMap }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
    } catch (err) {
      const clientError = err as ClientError;
      setError({ message: clientError.message, hint: clientError.hint });
    } finally {
      setBusy(false);
    }
  }

  function openManage(license: AdminLicenseRow) {
    setSelected(license);
    setManage({
      label: license.label ?? "",
      expiresInDays: license.expiresAt
        ? Math.max(0, Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0,
      generationLimit: license.generationLimit ?? 0,
      notes: license.notes ?? "",
    });
  }

  const chartMax = useMemo(
    () => Math.max(1, ...(stats?.dailyGenerations.map((day) => day.count) ?? [1])),
    [stats],
  );

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="h-5 w-5 animate-spin text-lavender-400" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-lavender-500/15 blur-[120px]" />
        <div className="relative w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-lg font-semibold">
              HookMerge <span className="text-lavender-400">AI</span>
            </span>
          </Link>
          <div className="glass rounded-3xl p-6 shadow-glow sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lavender-400/25 bg-lavender-400/10 text-lavender-300">
              <Lock className="h-5 w-5" />
            </span>
            <h1 className="mt-5 font-display text-xl font-semibold">Operator sign-in</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Admin access is separate from license access and uses the server&apos;s{" "}
              <span className="font-mono text-[10px] text-white/70">ADMIN_SECRET</span>.
            </p>
            <form onSubmit={login} className="mt-5 space-y-3">
              <div>
                <label htmlFor="admin-password" className="label">
                  Admin password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="input font-mono text-[13px]"
                  placeholder="••••••••••••"
                />
              </div>
              {loginError && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-300">
                  {loginError.message}
                  {loginError.hint && <p className="mt-0.5 text-red-300/70">{loginError.hint}</p>}
                </div>
              )}
              <button type="submit" disabled={loggingIn} className="btn-primary w-full">
                {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loggingIn ? "Checking…" : "Enter console"}
              </button>
            </form>
            <p className="mt-4 text-center text-[10px] text-muted/60">
              <Link href="/" className="hover:text-white">
                Back to hookmerge.ai
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="font-display text-sm font-semibold">
              HookMerge <span className="text-lavender-400">AI</span>
            </span>
            <span className="ml-1 hidden rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted sm:inline">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadAll()} disabled={loading} className="btn-ghost btn-sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <button onClick={() => void logout()} className="btn-secondary btn-sm">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lavender-400">Operator console</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Licenses & usage
            </h1>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-ink-900/60 p-1">
            {(
              [
                ["overview", "Overview", BarChart3],
                ["licenses", "Licenses", KeyRound],
                ["settings", "Settings", Settings],
              ] as [Tab, string, typeof BarChart3][]
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                  tab === id ? "bg-white/[0.08] text-white" : "text-muted hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <div>
              <p className="text-[12px] text-red-300">{error.message}</p>
              {error.hint && <p className="mt-0.5 text-[11px] text-red-300/70">{error.hint}</p>}
            </div>
          </div>
        )}

        {tab === "overview" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Active licenses",
                  value: stats ? String(stats.licenses.active) : "—",
                  sub: stats ? `${stats.licenses.total} total` : "",
                  icon: Users,
                },
                {
                  label: "Scripts generated",
                  value: stats ? String(stats.scripts.total) : "—",
                  sub: stats ? `${stats.scripts.today} today` : "",
                  icon: FileText,
                },
                {
                  label: "Generations this week",
                  value: stats ? String(stats.scripts.week) : "—",
                  sub: stats ? `${stats.licenses.expiringSoon} expiring soon` : "",
                  icon: Gauge,
                },
                {
                  label: "Running jobs",
                  value: stats ? String(stats.jobs.running) : "—",
                  sub: stats ? `${stats.jobs.failed} failed all-time` : "",
                  icon: Activity,
                },
              ].map((tile) => (
                <div key={tile.label} className="stat-tile">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{tile.label}</span>
                    <tile.icon className="h-3.5 w-3.5 text-lavender-300" />
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold">{tile.value}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{tile.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold">Generations · last 7 days</h2>
                  <span className="chip">scripts created</span>
                </div>
                <div className="mt-6 flex h-40 items-end gap-2">
                  {(stats?.dailyGenerations ?? []).map((day) => (
                    <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[9px] text-muted">{day.count}</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-lavender-500/25 to-lavender-400/80 transition-all"
                        style={{ height: `${Math.max(4, (day.count / chartMax) * 100)}%` }}
                        title={`${day.count} on ${day.day}`}
                      />
                      <span className="text-[9px] text-muted/70">{day.day}</span>
                    </div>
                  ))}
                  {!stats && <div className="skeleton h-full w-full" />}
                </div>
              </section>

              <section className="card p-5">
                <h2 className="font-display text-sm font-semibold">Provider mix</h2>
                <div className="mt-4 space-y-2.5">
                  {(stats?.providers ?? []).length === 0 && (
                    <p className="text-[11px] text-muted">No generations recorded yet.</p>
                  )}
                  {(stats?.providers ?? []).map((provider) => {
                    const max = Math.max(1, ...(stats?.providers.map((p) => p.count) ?? [1]));
                    return (
                      <div key={provider.provider}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/80">{provider.provider}</span>
                          <span className="text-muted">{provider.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-neon-400/70"
                            style={{ width: `${(provider.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
                  {[
                    ["Completed", stats?.jobs.completed ?? 0, "text-neon-400"],
                    ["Failed", stats?.jobs.failed ?? 0, "text-red-300"],
                    ["Cancelled", stats?.jobs.cancelled ?? 0, "text-muted"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)}>
                      <p className={`font-display text-lg ${color}`}>{value}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="font-display text-sm font-semibold">Newest licenses</h2>
                <button onClick={() => setTab("licenses")} className="text-[10px] text-lavender-300 hover:underline">
                  Manage all
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[11px]">
                  <thead>
                    <tr className="border-y border-white/[0.06] bg-white/[0.015]">
                      <th className="table-head px-5 py-2.5">Prefix</th>
                      <th className="table-head px-3 py-2.5">Label</th>
                      <th className="table-head px-3 py-2.5">Status</th>
                      <th className="table-head px-3 py-2.5">Usage</th>
                      <th className="table-head px-3 py-2.5">Expires</th>
                      <th className="table-head px-5 py-2.5 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recentLicenses ?? []).map((license) => (
                      <tr key={license.id} className="border-b border-white/[0.04]">
                        <td className="px-5 py-3 font-mono text-white/80">{license.keyPrefix}…</td>
                        <td className="px-3 py-3 text-muted">{license.label || "—"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge license={license} />
                        </td>
                        <td className="px-3 py-3 text-muted">{license.generationsUsed}</td>
                        <td className="px-3 py-3 text-muted">{formatDate(license.expiresAt)}</td>
                        <td className="px-5 py-3 text-right text-muted">{formatDate(license.createdAt)}</td>
                      </tr>
                    ))}
                    {(!stats || stats.recentLicenses.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-muted">
                          No licenses yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "licenses" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
              <section className="card p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <Plus className="h-4 w-4 text-lavender-300" /> Generate license keys
                </h2>
                <form onSubmit={createLicenses} className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="license-label" className="label">
                      Label (optional)
                    </label>
                    <input
                      id="license-label"
                      value={form.label}
                      onChange={(event) => setForm({ ...form, label: event.target.value })}
                      placeholder="e.g. Newsletter launch"
                      className="input input-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="license-qty" className="label">
                        Quantity
                      </label>
                      <input
                        id="license-qty"
                        type="number"
                        min={1}
                        max={50}
                        value={form.quantity}
                        onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                        className="input input-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="license-days" className="label">
                        Valid days
                      </label>
                      <input
                        id="license-days"
                        type="number"
                        min={0}
                        max={3650}
                        value={form.expiresInDays}
                        onChange={(event) => setForm({ ...form, expiresInDays: Number(event.target.value) })}
                        className="input input-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="license-limit" className="label">
                        Gen. limit
                      </label>
                      <input
                        id="license-limit"
                        type="number"
                        min={0}
                        max={100000}
                        value={form.generationLimit}
                        onChange={(event) => setForm({ ...form, generationLimit: Number(event.target.value) })}
                        className="input input-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted/70">0 days = no expiry. 0 limit = unlimited generations.</p>
                  <div>
                    <label htmlFor="license-notes" className="label">
                      Notes (optional)
                    </label>
                    <input
                      id="license-notes"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      placeholder="Internal reference"
                      className="input input-sm"
                    />
                  </div>
                  <button type="submit" disabled={creating} className="btn-primary w-full btn-sm">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {creating ? "Generating…" : "Generate keys"}
                  </button>
                </form>
              </section>

              <section className="card p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-neon-400" /> New keys
                </h2>
                {createdKeys.length === 0 ? (
                  <p className="mt-4 text-[11px] leading-relaxed text-muted">
                    Newly generated keys appear here once, in full, so you can copy them. Only a hash is stored
                    afterwards. Send each key to its owner over a secure channel.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    <div className="flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2 text-[10px] text-amber-200/80">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      Copy these now — they cannot be shown again.
                    </div>
                    {createdKeys.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-950/50 px-3 py-2"
                      >
                        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/90">{item.key}</code>
                        <button
                          onClick={async () => {
                            if (await copyToClipboard(item.key)) {
                              setCopiedKey(item.key);
                              setTimeout(() => setCopiedKey(null), 1600);
                            }
                          }}
                          className="text-muted hover:text-white"
                          aria-label="Copy key"
                        >
                          {copiedKey === item.key ? (
                            <Check className="h-3.5 w-3.5 text-neon-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setCreatedKeys([])} className="btn-ghost btn-sm w-full">
                      <X className="h-3 w-3" /> Hide keys
                    </button>
                  </div>
                )}
              </section>
            </div>

            <section className="card overflow-hidden">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-display text-sm font-semibold">Issued licenses</h2>
                <div className="relative sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search label or prefix"
                    className="input input-sm pl-8"
                    aria-label="Search licenses"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-[11px]">
                  <thead>
                    <tr className="border-y border-white/[0.06] bg-white/[0.015]">
                      <th className="table-head px-5 py-2.5">Prefix</th>
                      <th className="table-head px-3 py-2.5">Label</th>
                      <th className="table-head px-3 py-2.5">Status</th>
                      <th className="table-head px-3 py-2.5">Usage</th>
                      <th className="table-head px-3 py-2.5">Scripts</th>
                      <th className="table-head px-3 py-2.5">Expires</th>
                      <th className="table-head px-5 py-2.5 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((license) => (
                      <tr key={license.id} className="border-b border-white/[0.04] hover:bg-white/[0.015]">
                        <td className="px-5 py-3 font-mono text-white/80">{license.keyPrefix}…</td>
                        <td className="max-w-[180px] truncate px-3 py-3 text-muted">{license.label || "—"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge license={license} />
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {license.generationLimit ? `${license.generationsUsed}/${license.generationLimit}` : license.generationsUsed}
                        </td>
                        <td className="px-3 py-3 text-muted">{license.scripts}</td>
                        <td className="px-3 py-3 text-muted">{formatDate(license.expiresAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => openManage(license)} className="btn-secondary btn-sm">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                    {licenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-muted">
                          No licenses match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "settings" && (
          <section className="card mt-6 max-w-2xl p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Settings className="h-4 w-4 text-lavender-300" /> Application settings
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Defaults applied to newly generated licenses and upload validation.
            </p>
            {settings ? (
              <div className="mt-5 space-y-4">
                {(
                  [
                    ["license_generation_limit_default", "Default generation limit", "0 = unlimited"],
                    ["license_validity_days_default", "Default license validity (days)", "0 = never expires"],
                    ["max_upload_mb", "Max upload size (MB)", "Enforced on every upload"],
                  ] as [keyof SettingsMap, string, string][]
                ).map(([key, label, hint]) => (
                  <div key={key}>
                    <label htmlFor={`setting-${key}`} className="label">
                      {label}
                    </label>
                    <input
                      id={`setting-${key}`}
                      type="number"
                      min={0}
                      value={settings[key]}
                      onChange={(event) =>
                        setSettings({ ...settings, [key]: Number(event.target.value) })
                      }
                      className="input input-sm max-w-xs"
                    />
                    <p className="mt-1 text-[10px] text-muted/60">{hint}</p>
                  </div>
                ))}
                <button onClick={() => void saveSettings()} disabled={busy} className="btn-primary btn-sm">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save settings
                </button>
              </div>
            ) : (
              <div className="skeleton mt-5 h-40 w-full" />
            )}
          </section>
        )}
      </main>

      {/* Manage license modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] text-muted">{selected.keyPrefix}••••••</p>
                <h3 className="mt-1 font-display text-base font-semibold">
                  {selected.label || "License settings"}
                </h3>
                <p className="mt-0.5 text-[10px] text-muted">
                  Created {formatDateTime(selected.createdAt)} · {selected.generationsUsed} generations ·{" "}
                  {selected.scripts} scripts
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="manage-label" className="label">
                  Label
                </label>
                <input
                  id="manage-label"
                  value={manage.label}
                  onChange={(event) => setManage({ ...manage, label: event.target.value })}
                  className="input input-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="manage-days" className="label">
                    Valid days (0 = never)
                  </label>
                  <input
                    id="manage-days"
                    type="number"
                    min={0}
                    value={manage.expiresInDays}
                    onChange={(event) => setManage({ ...manage, expiresInDays: Number(event.target.value) })}
                    className="input input-sm"
                  />
                </div>
                <div>
                  <label htmlFor="manage-limit" className="label">
                    Generation limit
                  </label>
                  <input
                    id="manage-limit"
                    type="number"
                    min={0}
                    value={manage.generationLimit}
                    onChange={(event) => setManage({ ...manage, generationLimit: Number(event.target.value) })}
                    className="input input-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="manage-notes" className="label">
                  Notes
                </label>
                <input
                  id="manage-notes"
                  value={manage.notes}
                  onChange={(event) => setManage({ ...manage, notes: event.target.value })}
                  className="input input-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => void saveManage()} disabled={busy} className="btn-primary btn-sm flex-1">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save changes
              </button>
              {selected.status === "active" ? (
                <button
                  onClick={() => void patchLicense(selected.id, { action: "revoke" }, () => setSelected(null))}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                >
                  Revoke
                </button>
              ) : (
                <button
                  onClick={() => void patchLicense(selected.id, { action: "activate" }, () => setSelected(null))}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                >
                  Reactivate
                </button>
              )}
              <button
                onClick={() => void removeLicense(selected)}
                disabled={busy}
                className="btn-danger btn-sm"
                title="Delete license"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted/60">
              Revoking immediately invalidates every active session for this license.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ license }: { license: AdminLicenseRow }) {
  const expired = license.expiresAt != null && license.expiresAt <= Date.now();
  const label = license.status === "revoked" ? "Revoked" : expired ? "Expired" : "Active";
  const styles =
    label === "Active"
      ? "border-neon-400/30 bg-neon-400/[0.06] text-neon-400"
      : label === "Expired"
        ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-300"
        : "border-red-500/30 bg-red-500/[0.06] text-red-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${styles}`}>
      {label === "Active" && <Check className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}
