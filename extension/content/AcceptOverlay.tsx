import { useEffect, useRef, useState } from 'react';
import { rpc } from '@shared/rpc';
import { updateSettings } from '@shared/settings';
import type { AutoAcceptSettings } from '@shared/types/settings';
import { beep, safeClick, watchMatchFound } from './auto-accept';
import { t } from '@shared/i18n';

type Phase = { kind: 'idle' } | { kind: 'found'; btn: HTMLElement; left: number } | { kind: 'cancelled' } | { kind: 'accepted' } | { kind: 'manual' };

/** Countdown / notification toast for match-found prompts. */
export function AcceptOverlay({ settings }: { settings: AutoAcceptSettings }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const cfg = useRef(settings);
  cfg.current = settings;

  useEffect(
    () =>
      watchMatchFound(document, {
        onFound(btn) {
          const s = cfg.current;
          if (s.sound) beep();
          if (s.enabled && s.acknowledged) {
            setPhase({ kind: 'found', btn, left: s.delaySeconds });
          } else {
            setPhase({ kind: 'manual' });
            void rpc('notify.matchFound', { accepted: false }).catch(() => undefined);
          }
        },
        onGone() {
          setPhase((p) => (p.kind === 'accepted' ? p : { kind: 'idle' }));
        },
      }),
    [],
  );

  // Countdown tick. Disabling Auto Accept mid-countdown cancels immediately.
  useEffect(() => {
    if (phase.kind !== 'found') return;
    if (!settings.enabled) return setPhase({ kind: 'cancelled' });
    if (phase.left <= 0) {
      const ok = safeClick(document, phase.btn);
      setPhase(ok ? { kind: 'accepted' } : { kind: 'idle' });
      if (ok) void rpc('notify.matchFound', { accepted: true }).catch(() => undefined);
      return;
    }
    const timer = setTimeout(() => setPhase({ ...phase, left: phase.left - 1 }), 1000);
    return () => clearTimeout(timer);
  }, [phase, settings.enabled]);

  useEffect(() => {
    if (phase.kind !== 'accepted' && phase.kind !== 'cancelled') return;
    const timer = setTimeout(() => setPhase({ kind: 'idle' }), 5000);
    return () => clearTimeout(timer);
  }, [phase.kind]);

  if (phase.kind === 'idle') return null;

  return (
    <div role="status" aria-live="assertive" className="pointer-events-auto fixed left-1/2 top-5 z-[2147483647] w-[340px] -translate-x-1/2">
      <div className="st-card animate-rise overflow-hidden border-ember-500/40 p-4 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-ember-500 to-blood-500" />
        {phase.kind === 'found' && (
          <>
            <div className="st-label !text-ember-300">SykosTracker · Auto Accept</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-display text-[20px] font-bold uppercase">{t('aa.found')}</span>
              <span className="st-num text-[34px] leading-none text-ember-400">{phase.left}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="st-btn-ghost flex-1" onClick={() => setPhase({ kind: 'cancelled' })}>
                {t('cancel')}
              </button>
              <button
                className="st-btn-ghost flex-1"
                onClick={() => {
                  setPhase({ kind: 'cancelled' });
                  void updateSettings({ autoAccept: { ...settings, enabled: false } });
                }}
              >
                {t('aa.disable')}
              </button>
              <button className="st-btn-primary flex-1" onClick={() => setPhase({ ...phase, left: 0 })}>
                {t('aa.acceptNow')}
              </button>
            </div>
          </>
        )}
        {phase.kind === 'manual' && (
          <>
            <div className="st-label !text-ember-300">SykosTracker</div>
            <div className="font-display text-[20px] font-bold uppercase">{t('aa.foundManual')}</div>
            <div className="text-[12px] text-fog-400">{t('aa.manualSub')}</div>
          </>
        )}
        {phase.kind === 'accepted' && <div className="font-semibold text-win">✓ {t('aa.accepted')}</div>}
        {phase.kind === 'cancelled' && <div className="font-semibold text-fog-300">{t('aa.cancelled')}</div>}
      </div>
    </div>
  );
}
