import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main className="container-page max-w-3xl py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-400">Legal</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-xs text-muted">Last updated: 22 November 2026</p>

        <div className="prose-legal mt-10">
          <h2>What we store</h2>
          <ul>
            <li>
              <strong className="text-white">License records:</strong> a salted hash of your license
              key, a short display prefix, a label, status, expiry and generation counters. The full
              key is never stored after creation.
            </li>
            <li>
              <strong className="text-white">Session records:</strong> a hashed session token that
              lives in an HttpOnly cookie for seven days. Sessions can be revoked at any time.
            </li>
            <li>
              <strong className="text-white">AI configuration:</strong> provider, model, endpoint and
              your API key encrypted with AES-256-GCM before it is written to the database. If you
              choose a session-only key, it is kept in an encrypted HttpOnly cookie for twelve hours
              and never stored in the database.
            </li>
            <li>
              <strong className="text-white">Uploaded references:</strong> the video file, its name,
              size and type, stored on the operator&apos;s server bound to your license.
            </li>
            <li>
              <strong className="text-white">Generated scripts and transcripts:</strong> your niche,
              durations, modes, scripts, analyses and generation metadata, tied to your license.
            </li>
            <li>
              <strong className="text-white">Usage events:</strong> counts of generations per
              license and provider, used for license enforcement and operator statistics.
            </li>
          </ul>

          <h2>What we do not do</h2>
          <p>
            We do not sell your data, place advertising trackers on this site, or use third-party
            analytics scripts. We do not share one license holder&apos;s scripts, uploads or keys with
            another license holder. Every API route scopes data by the authenticated license.
          </p>

          <h2>Third-party processing</h2>
          <p>
            When you run a generation, the reference transcript (and audio, if transcription is
            required) is sent to the AI provider you configured, using your own API key, under that
            provider&apos;s privacy terms. For YouTube references, the server requests public video
            metadata and public caption tracks from YouTube. No protected media is downloaded.
          </p>

          <h2>Cookies</h2>
          <ul>
            <li>
              <code className="text-white/80">hm_session</code> — your license session (HttpOnly,
              SameSite=Lax).
            </li>
            <li>
              <code className="text-white/80">hm_ai_key</code> — optional session-only AI key,
              encrypted (HttpOnly, twelve hours).
            </li>
            <li>
              <code className="text-white/80">hm_admin</code> — operator admin session, set only
              after admin login.
            </li>
          </ul>
          <p>No advertising or cross-site tracking cookies are used.</p>

          <h2>Retention and deletion</h2>
          <p>
            Scripts remain until you delete them. Uploaded videos remain in your workspace until
            removed. Revoking a license ends its sessions immediately. Ask the operator to delete a
            license and its associated data if you want a full erasure.
          </p>

          <h2>Security</h2>
          <p>
            License verification, data access and admin actions are enforced server-side. Keys are
            encrypted at rest, secrets live in environment variables, and error messages are
            deliberately generic so they cannot be used to enumerate valid keys. No system is
            perfectly secure; report concerns through the contact page.
          </p>

          <h2>Contact</h2>
          <p>
            Privacy questions? <Link href="/contact" className="text-lavender-300 hover:underline">Get in touch</Link>.
          </p>
        </div>

        <div className="mt-12 flex gap-4 text-xs text-muted">
          <Link href="/terms" className="hover:text-white">
            Terms of Service
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
