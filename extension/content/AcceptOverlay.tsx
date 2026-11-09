import { useEffect, useRef, useState } from 'react';
import { rpc } from '@shared/rpc';
import type { AutoAcceptSettings } from '@shared/types/settings';
import { beep, findAcceptButton, safeClick, watchMatchFound } from './auto-accept';
import { t } from '@shared/i18n';

const CLICK_DELAY_MS = 300;

export function AcceptOverlay({ settings }: { settings: AutoAcceptSettings }) {
  const [manual, setManual] = useState(false);
  const cfg = useRef(settings);

  // Mantener siempre actualizada la ref con las settings más recientes
  useEffect(() => {
    cfg.current = settings;
  }, [settings]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = watchMatchFound(document, {
      onFound(initialBtn) {
        const s = cfg.current;

        if (s.enabled && s.acknowledged) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            // Validar que las opciones sigan activas
            if (!cfg.current.enabled || !cfg.current.acknowledged) return;

            // Re-obtener el elemento fresco en el DOM justo antes del clic
            const currentBtn = findAcceptButton(document) || initialBtn;
            
            // Intentar el clic con la referencia actualizada
            safeClick(document, currentBtn);
          }, CLICK_DELAY_MS);
          return;
        }

        // Si auto accept no está activo, mostrar aviso manual
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
  }, []); // Se mantiene [] para no re-suscribir el Observer innecesariamente

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
