import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  CheckCheck,
  Clapperboard,
  Clock3,
  Copy,
  FileAudio,
  FileText,
  Gauge,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wand2,
  Youtube,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LogoMark } from "@/components/logo";
import { PROVIDERS } from "@/lib/providers/registry";

const steps = [
  {
    n: "01",
    title: "Bring the reference",
    body: "Upload an MP4, MOV or WEBM, paste a YouTube link, or drop in a transcript. We pull the transcript and read the video the way an editor would.",
    icon: UploadCloud,
  },
  {
    n: "02",
    title: "Extract the mechanics",
    body: "Hook shape, first three seconds, pacing, curiosity gaps, retention moves, payoff. Fifteen signals, scored one by one — not a summary.",
    icon: BrainCircuit,
  },
  {
    n: "03",
    title: "Write your original",
    body: "Your niche, your duration, your model. A brand-new script that borrows the structure and leaves the content behind.",
    icon: Wand2,
  },
];

const features = [
  {
    icon: AudioLines,
    title: "Storytelling DNA, not a summary",
    body: "Every generation starts with a 15-point read of the reference: hook, narrative beats, sentence rhythm, emotional triggers, retention technique, payoff.",
  },
  {
    icon: KeyRound,
    title: "Your key. Your model. Your bill.",
    body: "Free NIM endpoints or a frontier model — you decide. Keys are encrypted server-side and never shipped to the browser bundle.",
  },
  {
    icon: Layers,
    title: "Provider adapters, built to extend",
    body: "NVIDIA NIM, OpenAI, Gemini, OpenRouter, Groq and any OpenAI-compatible endpoint share one adapter interface. Adding another is a config change.",
  },
  {
    icon: Clapperboard,
    title: "Any reference, handled properly",
    body: "Video uploads get ffmpeg audio extraction and Whisper-style transcription. YouTube links use public caption tracks. No transcript? Paste it.",
  },
  {
    icon: RefreshCw,
    title: "Rewrites that actually rewrite",
    body: "Improve the hook, make it more engaging, shorten, expand, or generate a different angle. Each action is a real model call, saved as a new version.",
  },
  {
    icon: ShieldCheck,
    title: "License-locked from the server",
    body: "Sessions are signed, stored server-side and checked on every protected endpoint. Front-end trickery gets you nowhere near the API.",
  },
];

const faqs = [
  {
    q: "How do I get a license key?",
    a: "HookMerge AI is licensed access only. Request a key through the contact page, and the operator issues one from the admin console with an optional expiry date and generation limit. Then verify it once — your session lasts seven days.",
  },
  {
    q: "Do I need my own AI API key?",
    a: "Yes. HookMerge is bring-your-own-key. That keeps your costs transparent and lets you pick the exact model you trust. NVIDIA NIM, Gemini and Groq all have free tiers that work out of the box.",
  },
  {
    q: "What happens to my uploaded video?",
    a: "It is stored on the server tied to your license, used once to extract audio and a transcript, and never shared with another user. You can remove it from your workspace at any time. Audio is sent only to the AI provider you configured, for transcription.",
  },
  {
    q: "Why can't it read every YouTube video?",
    a: "We only read public metadata and public caption tracks — we never bypass protection or download protected media. If captions are missing or the video is restricted, paste the transcript instead and the analysis pipeline works exactly the same.",
  },
  {
    q: "Is the generated script really original?",
    a: "The pipeline is instructed to borrow structure, never sentences, and never to reuse distinctive phrasing. You get a fresh concept for your niche. Always review before publishing — you own the final edit.",
  },
  {
    q: "Which models are best for scripts?",
    a: "Balanced and Premium modes reward stronger instruction-following models. The mode controls depth and analysis passes, not a fake quality label — the actual output quality comes from the model you select.",
  },
];

const plans = [
  {
    name: "Creator",
    price: "$39",
    tag: "One-time license",
    blurb: "For a creator shipping daily shorts.",
    features: ["1 license key", "Unlimited script generations", "All six provider adapters", "Video upload + YouTube references", "All rewrite actions"],
    cta: "Request a license",
    featured: false,
  },
  {
    name: "Pro",
    price: "$89",
    tag: "One-time license",
    blurb: "For a serious channel with a content system.",
    features: ["Everything in Creator", "Premium-mode deep analysis", "Priority support", "Extended retention map", "Commercial usage license"],
    cta: "Request a license",
    featured: true,
  },
  {
    name: "Studio",
    price: "$199",
    tag: "Team license",
    blurb: "For a small team running multiple channels.",
    features: ["Everything in Pro", "5 independent license keys", "Per-license usage tracking", "Admin-issued seats", "Revoke or expire any seat"],
    cta: "Talk to us",
    featured: false,
  },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative grid-bg">
        <div className="pointer-events-none absolute -left-40 top-24 h-80 w-80 rounded-full bg-lavender-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 top-64 h-72 w-72 rounded-full bg-neon-400/10 blur-[120px]" />

        <div className="container-page relative pt-16 pb-20 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium text-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-400" />
              </span>
              Licence-protected · Bring your own AI key
            </div>

            <h1 className="animate-fade-up mt-6 font-display text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl">
              Turn Any Reference Video Into Your{" "}
              <span className="grad-text">Next Viral Script.</span>
            </h1>

            <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
              Your reference. Your niche. Your next winning script. Let AI transform the way you
              create content.
            </p>

            <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/verify" className="btn-primary w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                Start Creating
              </Link>
              <Link href="#how-it-works" className="btn-secondary w-full sm:w-auto">
                <Play className="h-4 w-4" />
                How It Works
              </Link>
            </div>

            <p className="mt-5 text-[11px] text-muted/70">
              Upload · YouTube link · Pasted transcript — every path leads to a real, original script.
            </p>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="absolute -inset-x-8 -top-10 h-56 rounded-full bg-lavender-500/20 blur-[90px]" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/80 shadow-[0_40px_120px_-40px_rgba(139,92,246,0.45)] backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="ml-3 flex-1 truncate rounded-md bg-black/30 px-3 py-1 font-mono text-[10px] text-muted">
                  hookmerge.ai/app
                </div>
                <span className="hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-neon-400 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-400" /> workspace
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[196px_1fr]">
                <aside className="hidden border-r border-white/[0.06] bg-ink-950/50 p-3 sm:block">
                  <div className="mb-4 flex items-center gap-2 px-2 pt-1">
                    <LogoMark className="h-6 w-6" />
                    <span className="font-display text-xs font-semibold">HookMerge AI</span>
                  </div>
                  {[
                    { icon: Gauge, label: "Dashboard", active: true },
                    { icon: Wand2, label: "Create new script" },
                    { icon: FileText, label: "My scripts" },
                    { icon: KeyRound, label: "AI configuration" },
                    { icon: ShieldCheck, label: "Account / license" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] ${
                        item.active
                          ? "bg-lavender-400/[0.12] text-white"
                          : "text-muted/70"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                  ))}
                  <div className="mt-6 rounded-lg border border-white/[0.06] p-2.5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-muted/70">License</p>
                    <p className="mt-1 font-mono text-[10px] text-white">hm-8f3a1••••••</p>
                    <p className="mt-1 text-[9px] text-neon-400">Active · 7 days</p>
                  </div>
                </aside>

                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold sm:text-xl">
                        Create Your Next Viral Script
                      </h2>
                      <p className="mt-1 text-[11px] text-muted">
                        Give us your niche and a reference. Let AI handle the creative process.
                      </p>
                    </div>
                    <span className="chip chip-active hidden sm:inline-flex">
                      <Zap className="h-3 w-3" /> Balanced
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Your niche</p>
                      <p className="mt-1 text-[12px] text-white">Finance for 20-somethings</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Reference</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white">
                        <Youtube className="h-3.5 w-3.5 text-red-400" /> youtube.com · 49s
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="chip">
                      <KeyRound className="h-3 w-3" /> Groq · Llama 3.3 70B
                    </span>
                    <span className="chip">
                      <Clock3 className="h-3 w-3" /> 45 seconds
                    </span>
                    <span className="chip">
                      <FileAudio className="h-3 w-3" /> Transcript ready
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.35fr_1fr]">
                    <div className="rounded-xl border border-lavender-400/25 bg-gradient-to-br from-lavender-400/[0.08] to-transparent p-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lavender-300">
                          Generated hook
                        </p>
                        <Copy className="h-3 w-3 text-muted" />
                      </div>
                      <p className="mt-2 font-display text-[13px] leading-snug text-white">
                        “You are not bad with money — you were taught a system that quietly
                        keeps you broke.”
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-white/10" />
                        <div className="h-1.5 w-[92%] rounded-full bg-white/[0.07]" />
                        <div className="h-1.5 w-[78%] rounded-full bg-white/[0.05]" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-ink-950/50 p-3.5">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-muted">
                        Analysis signals
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                        {["Hook", "Pacing", "Curiosity", "Payoff", "Transitions", "Emotion"].map(
                          (item) => (
                            <span key={item} className="flex items-center gap-1 text-muted">
                              <CheckCheck className="h-3 w-3 text-neon-400" />
                              {item}
                            </span>
                          ),
                        )}
                      </div>
                      <div className="mt-3 rounded-lg bg-lavender-400/10 px-2 py-1.5 text-[10px] text-lavender-300">
                        Script generating…
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-center">
            {[
              ["6", "AI providers"],
              ["15", "analysis signals"],
              ["15–90s", "script lengths"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3">
                <p className="font-display text-lg font-semibold text-white">{value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="section border-t border-white/[0.06] bg-ink-900/30">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender-400">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps from reference to script.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              No prompt engineering, no blank page. HookMerge runs the analysis a strategist would
              run, then hands the findings to your chosen model as a writing brief.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="card glow-line relative p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-lavender-400/80">{step.n}</span>
                  <step.icon className="h-5 w-5 text-lavender-300" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-400">
                The engine
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Built like a writing room, not a wrapper.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Every stage is a real step with real output: transcript, analysis, strategy brief,
              script, revisions. Nothing is faked for the demo.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-6 transition hover:border-lavender-400/25 hover:from-lavender-400/[0.06]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink-950/60 text-lavender-300 transition group-hover:border-lavender-400/30 group-hover:text-lavender-300">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-[15px] font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      <section id="providers" className="section border-y border-white/[0.06] bg-ink-900/30">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender-400">
              Supported AI providers
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Use the brain you already trust.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              HookMerge never marks up your tokens. Connect a free key or a frontier model — you can
              switch providers between generations.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                className="card flex flex-col justify-between p-5 transition hover:border-white/15"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-950/70 font-display text-xs font-semibold text-lavender-300">
                        {provider.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-display text-sm font-semibold">{provider.label}</span>
                    </div>
                    {provider.freeTier && <span className="chip border-neon-400/25 text-neon-400">Free tier</span>}
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">{provider.tagline}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-muted/80">
                  <span>
                    {provider.allowCustomModel
                      ? `${provider.models.length || "Any"}${provider.models.length ? " models + custom" : " model"}`
                      : `${provider.models.length} models`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileAudio className="h-3 w-3" />
                    {provider.supportsTranscription ? "Audio in" : "Transcript in"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted/70">
            Custom endpoints work anywhere the OpenAI chat-completions format is served — Together,
            DeepInfra, vLLM, Ollama and more.
          </p>
        </div>
      </section>

      {/* Pricing / license */}
      <section id="pricing" className="section">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-400">
              Access
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              One license. Every workflow.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              HookMerge is licensed access, not a free trial. Licenses are issued by the operator,
              can expire or be revoked, and are verified server-side on every request.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-lavender-400/40 bg-gradient-to-b from-lavender-400/[0.1] to-transparent shadow-glow"
                    : "border-white/[0.08] bg-ink-850/60"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-lavender-400 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-950">
                    Most popular
                  </span>
                )}
                <p className="font-display text-sm font-semibold text-white">{plan.name}</p>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="font-display text-4xl font-semibold">{plan.price}</span>
                  <span className="pb-1 text-[11px] text-muted">{plan.tag}</span>
                </div>
                <p className="mt-2 text-[12px] text-muted">{plan.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] text-white/80">
                      <CheckCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mt-6 w-full ${plan.featured ? "btn-primary" : "btn-secondary"}`}
                >
                  {plan.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted/70">
            Already have a key?{" "}
            <Link href="/verify" className="text-lavender-300 underline-offset-4 hover:underline">
              Verify it here
            </Link>
            . AI usage is billed by your provider, never by HookMerge.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section border-t border-white/[0.06] bg-ink-900/30">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender-400">
              FAQ
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              The honest answers.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Anything else?{" "}
              <Link href="/contact" className="text-lavender-300 underline-offset-4 hover:underline">
                Send a message
              </Link>{" "}
              and a human will reply.
            </p>
          </div>

          <div className="divide-y divide-white/[0.07]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-white">{faq.q}</span>
                  <span className="faq-plus flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted transition-transform duration-200">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-lavender-500/[0.14] via-ink-900 to-ink-900 px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-neon-400/10 blur-[90px]" />
            <LogoMark className="mx-auto h-10 w-10 animate-float" />
            <h2 className="mx-auto mt-6 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop studying hooks. Start shipping them.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
              Your next reference is already on your feed. Bring it in, add your niche, and leave
              with a script in under two minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/verify" className="btn-primary w-full sm:w-auto">
                <Lock className="h-4 w-4" />
                Enter your license
              </Link>
              <Link href="/contact" className="btn-secondary w-full sm:w-auto">
                Request access
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
