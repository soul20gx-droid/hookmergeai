import Link from "next/link";
import { ArrowRight, Clock3, KeyRound, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Contact" };

const SUPPORT_EMAIL = "hello@hookmerge.ai";

export default function ContactPage() {
  return (
    <div>
      <SiteHeader />
      <main className="container-page max-w-4xl py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender-400">
          Contact
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Talk to a human.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          HookMerge AI is operated by a small team. License requests, billing questions, access
          issues and security reports all reach the same inbox.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-lavender-400/25 bg-lavender-400/10 text-lavender-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-base font-semibold">Request a license</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Tell us which plan you want and the niche you create in. Include the email you want the
              key sent to. Licenses are issued from the operator console, so you normally hear back
              the same day.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=HookMerge%20AI%20license%20request&body=Plan%3A%20%0ANiche%3A%20%0AHow%20you%20found%20us%3A%20`}
              className="btn-primary mt-5 w-full"
            >
              <Mail className="h-4 w-4" /> Email a license request
            </a>
          </div>

          <div className="card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon-400/25 bg-neon-400/10 text-neon-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-base font-semibold">Support & security</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Include your license prefix (the first six characters) and never send your full key or
              API key by email. For security reports, put &quot;security&quot; in the subject line.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=HookMerge%20AI%20support`} className="btn-secondary mt-5 w-full">
              <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Clock3, title: "Response time", body: "Usually within one business day." },
            { icon: ShieldCheck, title: "Report abuse", body: "Revoked licenses take effect immediately." },
            { icon: KeyRound, title: "Lost your key", body: "Send your purchase email and license prefix." },
          ].map((item) => (
            <div key={item.title} className="glass p-5">
              <item.icon className="h-4 w-4 text-lavender-300" />
              <p className="mt-3 text-[13px] font-medium">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Already have a license?</p>
            <p className="mt-1 text-[12px] text-muted">
              Verify it once and your workspace opens immediately.
            </p>
          </div>
          <Link href="/verify" className="btn-primary shrink-0">
            Verify license <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 flex gap-4 border-t border-white/[0.06] pt-6 text-xs text-muted">
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/" className="hover:text-white">
            Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
