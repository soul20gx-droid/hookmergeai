export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hm-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#A3FF75" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#hm-mark)" opacity="0.14" />
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#hm-mark)" strokeOpacity="0.55" fill="none" />
      <path
        d="M9 22.5V10.5M9 16.5h6.5M15.5 22.5V10.5"
        stroke="url(#hm-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M19.5 20.2l4.2-8.4 1.9 8.4" stroke="#A3FF75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">
          HookMerge <span className="text-lavender-400">AI</span>
        </span>
      )}
    </span>
  );
}
