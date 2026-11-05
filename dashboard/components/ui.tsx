/**
 * SykosTracker design-system primitives. Small, composable, no business logic.
 */
import { useState, type ReactNode } from 'react';
import { flagEmoji, levelColor, NA } from '@shared/utils/format';
import { mapHue, mapLabel, mapShort } from '@shared/utils/maps';
import { t } from '@shared/i18n';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('st-card animate-rise', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
          <h3 className="st-label text-fog-300">{title}</h3>
          {right}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-grid h-3.5 w-3.5 place-items-center rounded-full border border-white/15 text-[9px] font-bold text-fog-500 hover:text-fog-100"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-fog-300 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function StatTile({ label, value, sub, tone, hint }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' | 'ember'; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="st-label flex items-center">
        {label}
        {hint && <Info text={hint} />}
      </div>
      <div className={cx('st-num mt-1 text-[22px] leading-none', tone === 'up' && 'text-win', tone === 'down' && 'text-loss', tone === 'ember' && 'text-ember-400')}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-fog-500">{sub}</div>}
    </div>
  );
}

export function LevelBadge({ level, size = 26 }: { level: number | null | undefined; size?: number }) {
  const c = levelColor(level);
  return (
    <span
      title={level ? t('level.n', { n: level }) : t('level.na')}
      className="st-num inline-grid shrink-0 place-items-center rounded-full text-[11px]"
      style={{ width: size, height: size, color: c, boxShadow: `inset 0 0 0 2px ${c}`, background: '#0c0d10' }}
    >
      {level ?? '?'}
    </span>
  );
}

export function Avatar({ src, name, size = 36 }: { src: string | null | undefined; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="st-num grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-ink-600 to-ink-800 text-fog-300" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {name.slice(0, 1).toUpperCase() || '?'}
      </span>
    );
  }
  return <img src={src} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
}

export function Flag({ country }: { country: string | null | undefined }) {
  const f = flagEmoji(country);
  return f ? <span title={country?.toUpperCase()}>{f}</span> : null;
}

export function ResultChip({ win }: { win: boolean | null }) {
  if (win === null) return <span className="st-num inline-grid h-5 w-5 place-items-center rounded bg-white/5 text-[10px] text-fog-500">–</span>;
  return (
    <span className={cx('st-num inline-grid h-5 w-5 place-items-center rounded text-[10px]', win ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss')}>
      {win ? 'W' : 'L'}
    </span>
  );
}

export function FormStrip({ results, max = 20, nowrap }: { results: (boolean | null)[]; max?: number; nowrap?: boolean }) {
  if (!results.length) return <span className="text-fog-500">{NA}</span>;
  return (
    <div className={cx('flex gap-1', nowrap ? 'flex-nowrap' : 'flex-wrap')}>
      {results.slice(0, max).map((r, i) => (
        <ResultChip key={i} win={r} />
      ))}
    </div>
  );
}

/** Map "icon": an original typographic badge tinted per map — no third-party art. */
export function MapBadge({ map, size = 'md' }: { map: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const h = mapHue(map);
  const dims = size === 'sm' ? 'h-6 w-9 text-[10px]' : size === 'lg' ? 'h-12 w-16 text-[15px]' : 'h-8 w-12 text-[11px]';
  return (
    <span
      title={mapLabel(map)}
      className={cx('st-num relative inline-grid shrink-0 place-items-center overflow-hidden rounded-md tracking-widest', dims)}
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 22%), hsl(${h} 40% 9%))`, color: `hsl(${h} 90% 78%)`, boxShadow: `inset 0 0 0 1px hsl(${h} 60% 40% / .45)` }}
    >
      <span className="absolute inset-0 st-hatch opacity-60" />
      <span className="relative">{mapShort(map)}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-md bg-white/[0.04]', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-[68px]" />
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="mb-3 text-ember-500/70" aria-hidden>
        <path d="M20 4 34 12v16L20 36 6 28V12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 20h12M20 14v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="font-display text-[15px] font-semibold uppercase tracking-wider text-fog-100">{title}</p>
      {body && <div className="mt-1 max-w-md text-[13px] text-fog-400">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: { code?: string; message: string }; onRetry?: () => void }) {
  const cfg = error.code === 'NOT_CONFIGURED';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blood-500/30 bg-blood-500/[0.07] px-4 py-3 text-[13px]">
      <div>
        <div className="font-semibold text-blood-400">{cfg ? t('err.notConfigured') : t('err.loadFailed')}</div>
        <div className="text-fog-300">{error.message}</div>
      </div>
      {onRetry && !cfg && (
        <button className="st-btn-ghost" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={cx('flex gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug', tone === 'warn' ? 'border-ember-500/30 bg-ember-500/[0.07] text-ember-300' : 'border-white/[0.07] bg-white/[0.02] text-fog-400')}>
      <span aria-hidden>{tone === 'warn' ? '◆' : '●'}</span>
      <div>{children}</div>
    </div>
  );
}

/** Small "source & period" footnote required on every stat block. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] text-fog-500">{t('source')}: {children}</p>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-white/10 bg-ink-950/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx('rounded-md px-2.5 py-1 text-[12px] font-semibold transition', value === o.key ? 'bg-ember-500 text-ink-950' : 'text-fog-400 hover:text-fog-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ember-500 border-t-transparent', className)} />;
}

/**
 * Two-sided comparison bar: left (you, #e85a12) vs right (them, #3d9be9).
 * The side with the better value is drawn at full strength, the other dimmed.
 */
export function VersusBar({ a, b, better = 'higher' }: { a: number | null; b: number | null; better?: 'higher' | 'lower' }) {
  if (a === null || b === null || a + b === 0) return <div className="h-1.5 rounded-full bg-white/5" />;
  const share = (a / (a + b)) * 100;
  const aWins = better === 'higher' ? a > b : a < b;
  const bWins = better === 'higher' ? b > a : b < a;
  return (
    <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full">
      <div className="rounded-l-full" style={{ width: `${share}%`, background: '#e85a12', opacity: aWins ? 1 : 0.35 }} />
      <div className="rounded-r-full" style={{ width: `${100 - share}%`, background: '#3d9be9', opacity: bWins ? 1 : 0.35 }} />
    </div>
  );
}
