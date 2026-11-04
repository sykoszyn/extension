/** SykosTracker mark: a faceted crosshair-hexagon. Original artwork. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="stg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a4c" />
          <stop offset="1" stopColor="#ef3346" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#0c0d10" stroke="url(#stg)" strokeWidth="4" />
      <path d="M32 15v10M32 39v10M15 32h10M39 32h10" stroke="url(#stg)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="4.5" fill="url(#stg)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[19px] font-bold uppercase leading-none tracking-[0.08em]">
        Sykos<span className="text-ember-500">Tracker</span>
      </span>
    </span>
  );
}
