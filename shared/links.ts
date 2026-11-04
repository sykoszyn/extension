/**
 * Creator links configured in sykos.config.json ("twitter", "donate") and
 * compiled in at build time. Empty strings mean "don't show".
 */
declare const __SYKOS_LINKS__: { twitter: string; donate: string };

export const LINKS: { twitter: string; donate: string } =
  typeof __SYKOS_LINKS__ === 'object' && __SYKOS_LINKS__ ? __SYKOS_LINKS__ : { twitter: '', donate: '' };

/** "https://x.com/sykoszyn" → "@sykoszyn" (falls back to "X / Twitter"). */
export function handleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const first = u.pathname.split('/').filter(Boolean)[0];
    return /(^|\.)(x|twitter)\.com$/i.test(u.hostname) && first ? `@${first}` : 'X / Twitter';
  } catch {
    return 'X / Twitter';
  }
}
