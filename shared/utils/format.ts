/** Display helpers. `null` always renders as an em dash — never as 0. Locale follows the UI language. */
import { locale } from '../i18n';

export const NA = '—';

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NA;
  return n.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(n: number | null | undefined, digits = 0): string {
  return n === null || n === undefined ? NA : `${fmt(n, digits)}%`;
}

export function ratio(n: number | null | undefined): string {
  return fmt(n, 2);
}

export function date(ms: number | null | undefined, withTime = false): string {
  if (!ms) return NA;
  const d = new Date(ms);
  return d.toLocaleDateString(locale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function relative(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return NA;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const m = Math.round((ms - now) / 60_000); // negative = past
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, 'hour');
  const d = Math.round(h / 24);
  if (Math.abs(d) < 31) return rtf.format(d, 'day');
  const mo = Math.round(d / 30);
  if (Math.abs(mo) < 12) return rtf.format(mo, 'month');
  return rtf.format(Math.round(mo / 12), 'year');
}

export function duration(startMs: number | null, endMs: number | null): string {
  if (!startMs || !endMs || endMs < startMs) return NA;
  const min = Math.round((endMs - startMs) / 60_000);
  return `${min} min`;
}

export function flagEmoji(country: string | null | undefined): string {
  if (!country || !/^[a-z]{2}$/i.test(country)) return '';
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function levelColor(level: number | null | undefined): string {
  if (!level) return '#6e7482';
  if (level <= 1) return '#eeeeee';
  if (level <= 3) return '#1ce400';
  if (level <= 7) return '#ffc800';
  if (level <= 9) return '#ff6309';
  return '#fe1f00';
}
