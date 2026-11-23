"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import type { AiConfigView, ProviderInfo } from "@/lib/types";
import { apiFetch, ClientError, formatDateTime } from "@/lib/client";

type ConfigResponse = { config: AiConfigView; providers: ProviderInfo[] };

type Message = { type: "success" | "error"; text: string; hint?: string } | null;

export function AiConfigPanel() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [config, setConfig] = useState<AiConfigView | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [testResult, setTestResult] = useState<{ latencyMs: number; model: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<ConfigResponse>("/api/config/ai")
      .then((data) => {
        if (!active) return;
        setProviders(data.providers);
        setConfig(data.config);
        setProvider(data.config.provider || "openai");
        setModel(data.config.model || data.providers.find((p) => p.id === data.config.provider)?.models[0]?.id || "");
        setBaseUrl(data.config.baseUrl || "");
      })
      .catch((err: ClientError) => {
        if (err.status === 401) router.replace("/verify");
        else setMessage({ type: "error", text: err.message, hint: err.hint });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const selected = useMemo(() => providers.find((p) => p.id === provider), [providers, provider]);

  function selectProvider(next: string) {
    setProvider(next);
    const providerDef = providers.find((p) => p.id === next);
    setModel(providerDef?.models[0]?.id ?? "");
    setBaseUrl("");
    setApiKey("");
    setTestResult(null);
    setMessage(null);
  }

  function validate(): string | null {
    if (!selected) return "Choose a provider.";
    if (!model.trim()) return "Choose or type a model identifier.";
    if (selected.allowCustomBaseUrl && !/^https?:\/\//i.test(baseUrl.trim())) {
      return "Enter your endpoint base URL, for example https://api.together.xyz/v1.";
    }
    if (!(config?.hasKey && config.provider === provider) && !apiKey.trim()) return "Paste your API key.";
    return null;
  }

  async function testConnection() {
    setMessage(null);
    setTestResult(null);
    if (!model.trim()) {
      setMessage({ type: "error", text: "Choose a model before testing." });
      return;
    }
    if (!apiKey.trim() && !(config?.hasKey && config.provider === provider)) {
      setMessage({ type: "error", text: "Paste an API key to test the connection." });
      return;
    }
    setTesting(true);
    try {
      const data = await apiFetch<{ latencyMs: number; model: string; provider: string }>("/api/config/test", {
        method: "POST",
        body: JSON.stringify({ provider, model, baseUrl, apiKey: apiKey.trim() || undefined }),
      });
      setTestResult({ latencyMs: data.latencyMs, model: data.model });
      setMessage({
        type: "success",
        text: `Connection works — ${data.provider} answered in ${(data.latencyMs / 1000).toFixed(2)}s.`,
      });
    } catch (err) {
      const clientError = err as ClientError;
      setMessage({ type: "error", text: clientError.message, hint: clientError.hint });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setMessage(null);
    const validation = validate();
    if (validation) {
      setMessage({ type: "error", text: validation });
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch<{ config: AiConfigView }>("/api/config/ai", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          model: model.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() || undefined,
          keyMode: "stored",
        }),
      });
      setConfig(data.config);
      setApiKey("");
      setMessage({
        type: "success",
        text: "Configuration saved and encrypted for your license.",
      });
    } catch (err) {
      const clientError = err as ClientError;
      setMessage({ type: "error", text: clientError.message, hint: clientError.hint });
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    if (!window.confirm("Remove your saved AI configuration from the server?")) return;
    setRemoving(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ config: AiConfigView }>("/api/config/ai", { method: "DELETE" });
      setConfig(data.config);
      setApiKey("");
      setTestResult(null);
      setMessage({ type: "success", text: "Saved configuration removed. Add a key to generate again." });
    } catch (err) {
      const clientError = err as ClientError;
      setMessage({ type: "error", text: clientError.message, hint: clientError.hint });
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">AI Configuration</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Connect Your AI Brain</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            Use your own provider key. It never reaches the browser bundle, other licenses, or our logs.
          </p>
        </div>
        <Link href="/app" className="btn-secondary btn-sm">
          Back to studio
        </Link>
      </div>

      {config?.hasKey && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-400/20 bg-neon-400/[0.04] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-neon-400" />
            <div>
              <p className="text-[12px] font-medium text-white">
                Connected: {config.provider} · {config.model}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {`Encrypted key ${config.maskedKey ?? ""}`}
                {config.updatedAt ? ` · updated ${formatDateTime(config.updatedAt)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Link href="/app" className="btn-primary btn-sm">
              <Zap className="h-3.5 w-3.5" /> Generate
            </Link>
            <button onClick={() => void removeKey()} disabled={removing} className="btn-ghost btn-sm text-red-300">
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${
            message.type === "success"
              ? "border-neon-400/25 bg-neon-400/[0.05]"
              : "border-red-500/25 bg-red-500/[0.07]"
          }`}
        >
          <p className={`text-[12px] ${message.type === "success" ? "text-neon-400" : "text-red-300"}`}>
            {message.text}
          </p>
          {message.hint && (
            <p className={`mt-0.5 text-[11px] ${message.type === "success" ? "text-muted" : "text-red-300/70"}`}>
              {message.hint}
            </p>
          )}
        </div>
      )}

      <section className="card mt-5 p-5 sm:p-6">
        <h2 className="font-display text-sm font-semibold">1. Choose a provider</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {providers.map((item) => {
            const active = provider === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProvider(item.id)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  active
                    ? "border-lavender-400/45 bg-lavender-400/[0.08]"
                    : "border-white/[0.07] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-white">{item.label}</span>
                  <span className="flex items-center gap-1">
                    {item.freeTier && (
                      <span className="rounded-full border border-neon-400/25 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-neon-400">
                        free
                      </span>
                    )}
                    {item.supportsTranscription && <AudioLines className="h-3 w-3 text-lavender-300" />}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.tagline}</p>
                <p className="mt-2 font-mono text-[9px] text-muted/60">
                  {item.allowCustomBaseUrl || !item.baseUrl ? "your endpoint" : new URL(item.baseUrl).host}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">2. Model & key</h2>
          {selected?.docsUrl && (
            <a
              href={selected.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] text-lavender-300 hover:underline"
            >
              Get a {selected.label} key <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-model" className="label">
              Model identifier
            </label>
            <input
              id="ai-model"
              list="ai-model-options"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={selected?.models[0]?.id || "your-model-id"}
              className="input font-mono text-[12px]"
            />
            <datalist id="ai-model-options">
              {selected?.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </datalist>
            <p className="mt-1.5 text-[10px] text-muted/70">
              Pick a suggestion or type any model your key can access.
            </p>
          </div>

          <div>
            <label htmlFor="ai-key" className="label">
              API key
            </label>
            <div className="relative">
              <input
                id="ai-key"
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={config?.hasKey ? "Saved — leave blank to keep it" : selected?.keyHint || "Paste your key"}
                autoComplete="off"
                spellCheck={false}
                className="input pr-10 font-mono text-[12px]"
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                aria-label={reveal ? "Hide key" : "Show key"}
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted/70">
              <Lock className="h-2.5 w-2.5" /> Sent only to your provider, from our server.
            </p>
          </div>
        </div>

        {selected?.allowCustomBaseUrl && (
          <div className="mt-4">
            <label htmlFor="ai-base" className="label">
              API base URL
            </label>
            <input
              id="ai-base"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.together.xyz/v1"
              className="input font-mono text-[12px]"
            />
            <p className="mt-1.5 text-[10px] text-muted/70">
              Any OpenAI-compatible endpoint that serves <span className="font-mono">/chat/completions</span>.
            </p>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-neon-400/20 bg-neon-400/[0.05] p-3.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold text-neon-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Encrypted storage per license
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Your API key is encrypted with AES-256-GCM and stored separately for your license. It is never shown again in full.
          </p>
        </div>

        {selected && !selected.supportsTranscription && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <p className="text-[10px] leading-relaxed text-amber-200/80">
              {selected.transcriptionNote ||
                "This provider can't transcribe audio. Uploaded videos will need a pasted transcript."}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => void save()} disabled={saving} className="btn-primary flex-1 sm:flex-none">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save configuration"}
          </button>
          <button onClick={() => void testConnection()} disabled={testing} className="btn-secondary">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>

        {testResult && (
          <p className="mt-3 text-[10px] text-muted">
            Tested <span className="font-mono text-white/80">{testResult.model}</span> · round trip{" "}
            {(testResult.latencyMs / 1000).toFixed(2)}s
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lavender-300" />
          <div className="text-[10px] leading-relaxed text-muted">
            <p className="font-medium text-white/80">How your key is handled</p>
            <p className="mt-1">
              Keys are encrypted before storage, decrypted only inside server-side provider calls, and never
              logged or returned to the client. The studio shows only a masked preview. Remove the key at any
              time with &quot;Remove&quot;.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 text-[10px] text-muted/60">
        <KeyRound className="h-3 w-3" /> Provider costs are billed by the provider, not by HookMerge.
      </div>
    </div>
  );
}
