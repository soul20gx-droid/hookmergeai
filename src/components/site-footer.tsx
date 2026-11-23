import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-ink-900/40">
      <div className="container-page py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Your reference. Your niche. Your next winning script. HookMerge AI studies why a
              video works, then writes something original for your audience.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Product
              </p>
              <ul className="space-y-2 text-muted">
                <li>
                  <Link href="/#how-it-works" className="transition hover:text-white">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/#providers" className="transition hover:text-white">
                    AI providers
                  </Link>
                </li>
                <li>
                  <Link href="/#pricing" className="transition hover:text-white">
                    Access
                  </Link>
                </li>
                <li>
                  <Link href="/verify" className="transition hover:text-white">
                    Verify license
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Legal
              </p>
              <ul className="space-y-2 text-muted">
                <li>
                  <Link href="/terms" className="transition hover:text-white">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="transition hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition hover:text-white">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Operators
              </p>
              <ul className="space-y-2 text-muted">
                <li>
                  <Link href="/admin" className="transition hover:text-white">
                    Admin console
                  </Link>
                </li>
                <li>
                  <Link href="/api/health" className="transition hover:text-white">
                    System status
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HookMerge AI. All rights reserved.</p>
          <p>Built for creators who study the craft. Please respect the platforms you publish to.</p>
        </div>
      </div>
    </footer>
  );
}
