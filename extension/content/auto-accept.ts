/**
 * Match-found detection + optional Auto Accept.
 *
 * Scope & safety (by design):
 *  - Works ONLY through FACEIT's visible UI: it finds the official "Accept"
 *    button of the match-found dialog and, if — and only if — the user
 *    enabled Auto Accept, calls `.click()` on it after a cancellable
 *    countdown. No network requests are made or modified, no tokens touched.
 *  - Detection is conservative: the button text must be exactly an "Accept"
 *    label AND sit in a dialog whose text looks like a match-found prompt
 *    AND not look like a party/friend invite. If FACEIT changes its markup
 *    the feature fails closed (nothing is clicked) and we only fail to notify.
 */

export const ACCEPT_LABELS = ['accept', 'aceptar', 'accepter', 'akzeptieren', 'accetta', 'aceitar', 'akceptuj', 'kabul et', 'принять', 'прийняти'];

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [class*="modal" i], [class*="dialog" i], [class*="matchready" i], [class*="match-ready" i]';

export const MATCH_CONTEXT_RE =
  /(match|partida|partie|spiel|partita|матч)[^.]{0,40}(found|ready|encontrada|lista|trouv|gefunden|pronta|pronto|trovata|найден|готов)|ready\s*check|accept\s+(the\s+)?match|aceptar\s+partida/i;
export const INVITE_RE = /invit|party|grupo|einladung|приглаш|friend request|solicitud de amistad|join team/i;

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function isVisible(el: Element): boolean {
  const h = el as HTMLElement;
  if (h.hidden || h.getAttribute('aria-hidden') === 'true') return false;
  if ((h as HTMLButtonElement).disabled) return false;
  const style = h.ownerDocument.defaultView?.getComputedStyle(h);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
  // Real browsers: also require a rendered box (checkVisibility: Chrome 105+, Firefox 106+).
  const cv = (h as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
  if (typeof cv === 'function' && !cv.call(h)) return false;
  return true;
}

/** Returns the official accept button of a match-found dialog, or null. */
export function findAcceptButton(root: ParentNode): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>('button, [role="button"]');
  for (const el of candidates) {
    if (!ACCEPT_LABELS.includes(norm(el.textContent))) continue;
    const dialog = el.closest(DIALOG_SELECTOR);
    if (!dialog) continue;
    const text = norm(dialog.textContent);
    if (!MATCH_CONTEXT_RE.test(text) || INVITE_RE.test(text)) continue;
    if (!isVisible(el)) continue;
    return el;
  }
  return null;
}

export interface AcceptEvents {
  /** A new match-found prompt appeared. */
  onFound(button: HTMLElement): void;
  /** The prompt disappeared (accepted manually, declined or timed out). */
  onGone(): void;
}

/** Observes the page and reports match-found prompts (throttled to one check per frame). */
export function watchMatchFound(doc: Document, ev: AcceptEvents): () => void {
  let current: HTMLElement | null = null;
  let scheduled = false;
  const check = () => {
    scheduled = false;
    const btn = findAcceptButton(doc);
    if (btn && btn !== current) {
      current = btn;
      ev.onFound(btn);
    } else if (!btn && current) {
      current = null;
      ev.onGone();
    }
  };
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(check);
  });
  obs.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled'] });
  check();
  return () => obs.disconnect();
}

/** Clicks only if the very same button is still attached, visible and matching. */
export function safeClick(doc: Document, btn: HTMLElement): boolean {
  if (!btn.isConnected) return false;
  if (findAcceptButton(doc) !== btn) return false;
  btn.click();
  return true;
}

export function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* autoplay policies may block audio until user interaction */
  }
}
