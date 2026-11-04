/**
 * Small, self-explanatory building blocks shared by the popup and Settings:
 * nickname linking and the Auto Accept switch (with an inline, one-time
 * confirmation instead of a separate "acknowledge" toggle).
 */
import { useState } from 'react';
import { rpc, RpcError } from '@shared/rpc';
import type { Settings } from '@shared/types/settings';
import { Spinner, cx } from './ui';

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40', checked ? 'bg-ember-500' : 'bg-ink-600')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

/** "Your FACEIT nickname" + Save. Resolves the nickname to verify it exists. */
export function NicknameForm({ settings, update, onDone, autoFocus }: { settings: Settings; update: (p: Partial<Settings>) => Promise<unknown>; onDone?: () => void; autoFocus?: boolean }) {
  const [nick, setNick] = useState(settings.myNickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const q = nick.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const p = await rpc('player.resolve', { query: q, force: true });
      await update({ myNickname: p.nickname, myPlayerId: p.id });
      onDone?.();
    } catch (e) {
      setError(e instanceof RpcError && e.code === 'NOT_FOUND' ? `No existe "${q}" en FACEIT. Revisa mayúsculas y guiones.` : String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block">
        <span className="st-label">Tu nickname de FACEIT</span>
        <input className="st-input mt-1 !py-2.5 !text-[14px]" value={nick} autoFocus={autoFocus} onChange={(e) => setNick(e.target.value)} placeholder="tu_nickname" spellCheck={false} />
      </label>
      <button className="st-btn-primary w-full !py-2.5 !text-[14px]" disabled={busy || !nick.trim()}>
        {busy ? <Spinner className="border-ink-950 border-t-transparent" /> : 'Guardar'}
      </button>
      {error && <p className="text-[12px] text-blood-400">{error}</p>}
    </form>
  );
}

/** Auto Accept row. The first time it is switched on, asks for a one-click confirmation. */
export function AutoAcceptSwitch({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => Promise<unknown> }) {
  const aa = settings.autoAccept;
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<Settings['autoAccept']>) => update({ autoAccept: { ...aa, ...patch } });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-ember-400" aria-hidden>
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
            Auto-aceptar partidas
          </div>
          <div className="text-[12px] text-fog-500">{aa.enabled ? `Acepta tras ${aa.delaySeconds} s (puedes cancelar)` : 'Acepta solo cuando aparece una partida'}</div>
        </div>
        <Toggle
          label="Auto-aceptar partidas"
          checked={aa.enabled}
          onChange={(v) => {
            if (!v) return void set({ enabled: false });
            if (aa.acknowledged) return void set({ enabled: true });
            setConfirming(true);
          }}
        />
      </div>
      {confirming && (
        <div className="mt-2 rounded-lg border border-ember-500/30 bg-ember-500/[0.07] p-2.5 text-[12px] text-ember-200">
          Pulsará el botón «Aceptar» de FACEIT por ti tras una cuenta atrás. FACEIT podría no permitir automatizar su web: úsalo bajo tu responsabilidad.
          <div className="mt-2 flex gap-2">
            <button
              className="st-btn-primary !py-1"
              onClick={() => {
                setConfirming(false);
                void set({ enabled: true, acknowledged: true });
              }}
            >
              Activar
            </button>
            <button className="st-btn-ghost !py-1" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
