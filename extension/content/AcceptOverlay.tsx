import { useEffect, useRef, useState } from 'react';
import { rpc } from '@shared/rpc';
import type { AutoAcceptSettings } from '@shared/types/settings';
import { beep, safeClick, watchMatchFound } from './auto-accept';
import { t } from '@shared/i18n';

/**
 * Match-found handling.
 *
 *  - Auto Accept ON (enabled + acknowledged by the user): clicks FACEIT's own
 *    "Accept" button silently — no toast, no sound, no notification. It is a
 *    single short timer, so it works with FACEIT in a background tab or the
 *    window minimized.
 *  - Auto Accept OFF: never clicks; shows a small reminder (and, if enabled,
 *    a system notification + sound) so the user can accept by hand.
 */
const CLICK_DELAY_MS = 300; // let FACEIT finish rendering the dialog

export function AcceptOverlay({ settings }: { settings: AutoAcceptSettings }) {
  const [manual, setManual] = useState(false);
  const cfg = useRef(settings);
  cfg.current = settings;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchMatchFound(document, {
      onFound(btn) {
        const s = cfg.current;
        if (s.enabled && s.acknowledged) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            // Re-check: the user may have turned it off in the meantime.
            if (cfg.current.enabled && cfg.current.acknowledged) safeClick(document, btn);
          }, CLICK_DELAY_MS);
          return;
        }
        setManual(true);
        if (s.sound) beep();
        void rpc('notify.matchFound', { accepted: false }).catch(() => undefined);
      },
      onGone() {
        clearTimeout(timer);
        setManual(false);
      },
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, []);

  if (!manual) return null;

  return (
    <div role="status" aria-live="assertive" className="pointer-events-auto fixed left-1/2 top-5 z-[2147483647] w-[340px] -translate-x-1/2">
      <div className="st-card animate-rise overflow-hidden border-ember-500/40 p-4 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-ember-500 to-blood-500" />
        <div className="st-label !text-ember-300">SykosTracker</div>
        <div className="font-display text-[20px] font-bold uppercase">{t('aa.foundManual')}</div>
        <div className="text-[12px] text-fog-400">{t('aa.manualSub')}</div>
      </div>
    </div>
  );
}
