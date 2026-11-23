import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="container-page max-w-3xl py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lavender-400">
          Legal
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-xs text-muted">Last updated: 22 November 2026</p>

        <div className="prose-legal mt-10">
          <h2>1. Licensed access</h2>
          <p>
            HookMerge AI is provided under a license key issued by the operator. A license may be
            time-limited, generation-limited, suspended or revoked. Access requires successful
            server-side license verification. Sharing, reselling or publishing a license key, or
            attempting to bypass license enforcement, is a breach of these terms.
          </p>

          <h2>2. Bring your own AI provider</h2>
          <p>
            You connect your own API key for a supported artificial intelligence provider. Your use
            of that provider is governed by that provider&apos;s terms, acceptable-use policy and
            pricing. HookMerge does not resell AI capacity and is not responsible for provider
            outages, quota changes, model deprecations or billing.
          </p>
          <p>
            You are responsible for the accuracy, legality and appropriateness of the content you
            generate and publish. AI output can be wrong. Review it before publishing.
          </p>

          <h2>3. Reference material</h2>
          <p>
            You must have the right to use any reference video, URL or transcript you submit. Do not
            upload material you do not have permission to process. HookMerge uses reference material
            only to analyse structure and generate new material; it does not publish, redistribute
            or resell your references.
          </p>
          <p>
            We do not bypass technical protection measures on third-party platforms. Where captions
            or metadata are unavailable, the product asks you for a transcript instead.
          </p>

          <h2>4. Originality</h2>
          <p>
            The generation pipeline is designed to produce original scripts and is instructed not to
            copy sentences or distinctive phrasing from references. No automated system can
            guarantee absolute originality. You are responsible for reviewing output before
            publication and for complying with platform policies and copyright law.
          </p>

          <h2>5. Acceptable use</h2>
          <ul>
            <li>No illegal, defamatory, harassing or fraudulent content.</li>
            <li>No attempts to access other users&apos; data, sessions or scripts.</li>
            <li>No automated scraping, load testing or denial-of-service behaviour.</li>
            <li>No removal of license, copyright or attribution notices.</li>
          </ul>

          <h2>6. Availability and warranties</h2>
          <p>
            The service is provided &quot;as is&quot;, without warranties of any kind, express or
            implied, including fitness for a particular purpose. We do not guarantee uninterrupted
            availability, specific creative results, views, engagement or revenue.
          </p>

          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the operator is not liable for indirect,
            incidental, special or consequential damages, or for lost profits, data or goodwill
            arising from use of the service. Total liability is limited to the amount you paid for
            your license.
          </p>

          <h2>8. Changes</h2>
          <p>
            These terms may be updated as the product evolves. Material changes will be reflected on
            this page with a new date. Continued use after a change constitutes acceptance.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about these terms? <Link href="/contact" className="text-lavender-300 hover:underline">Contact us</Link>.
          </p>
        </div>

        <div className="mt-12 flex gap-4 text-xs text-muted">
          <Link href="/privacy" className="hover:text-white">
            Privacy Policy
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
