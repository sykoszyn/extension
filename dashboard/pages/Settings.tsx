import { useEffect, useState, type ReactNode } from 'react';
import { rpc } from '@shared/rpc';
import type { Settings } from '@shared/types/settings';
import { Card, Notice, Spinner, cx } from '../components/ui';

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="st-label">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-fog-500">{hint}</span>}
    </label>
  );
}

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

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/[0.05] py-3 first:border-0 first:pt-0">
      <div>
        <div className="font-semibold">{title}</div>
        {desc && <div className="text-[12px] text-fog-400">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [nick, setNick] = useState(settings.myNickname);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const saveConnection = async () => {
    setBusy(true);
    setStatus(null);
    await update({
      apiMode: draft.apiMode,
      backendUrl: draft.backendUrl.trim(),
      backendAnonKey: draft.backendAnonKey.trim(),
      faceitApiKey: draft.faceitApiKey.trim(),
    });
    const r = await rpc('api.test', {}).catch((e) => ({ ok: false, message: String(e.message) }));
    setStatus({ ok: r.ok, msg: r.message });
    setBusy(false);
  };

  const saveNick = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const p = await rpc('player.resolve', { query: nick.trim(), force: true });
      await update({ myNickname: p.nickname, myPlayerId: p.id });
      setStatus({ ok: true, msg: `Cuenta vinculada: ${p.nickname} (${p.elo ?? '—'} ELO).` });
    } catch (e) {
      setStatus({ ok: false, msg: String((e as Error).message) });
    }
    setBusy(false);
  };

  const aa = settings.autoAccept;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Tu cuenta">
        <div className="flex gap-2">
          <input className="st-input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Tu nickname de FACEIT" />
          <button className="st-btn-primary" disabled={busy || !nick.trim()} onClick={saveNick}>
            Vincular
          </button>
        </div>
        <p className="mt-2 text-[12px] text-fog-400">
          {settings.myPlayerId ? (
            <>
              Vinculado como <b className="text-fog-100">{settings.myNickname}</b> · ID <span className="font-mono">{settings.myPlayerId}</span>
            </>
          ) : (
            'Solo se guarda tu nickname público y tu ID de FACEIT, en este navegador. Nunca contraseñas ni cookies.'
          )}
        </p>
      </Card>

      <Card title="Conexión con FACEIT API">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['backend', 'direct'] as const).map((m) => (
              <button key={m} className={draft.apiMode === m ? 'st-btn-primary' : 'st-btn-ghost'} onClick={() => setDraft({ ...draft, apiMode: m })}>
                {m === 'backend' ? 'Backend Supabase (recomendado)' : 'Clave propia (directo)'}
              </button>
            ))}
          </div>
          {draft.apiMode === 'backend' ? (
            <>
              <Field label="URL del proyecto Supabase" hint="p. ej. https://abcd1234.supabase.co">
                <input className="st-input" value={draft.backendUrl} onChange={(e) => setDraft({ ...draft, backendUrl: e.target.value })} placeholder="https://xxxx.supabase.co" />
              </Field>
              <Field label="Anon key (pública)" hint="La clave anon es pública por diseño. La clave de FACEIT vive como secreto en la Edge Function.">
                <input className="st-input font-mono" value={draft.backendAnonKey} onChange={(e) => setDraft({ ...draft, backendAnonKey: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="FACEIT client-side API key" hint="Crea una en developers.faceit.com → App Studio → API Keys (tipo Client side). Se guarda solo en este navegador.">
                <input className="st-input font-mono" type="password" value={draft.faceitApiKey} onChange={(e) => setDraft({ ...draft, faceitApiKey: e.target.value })} />
              </Field>
              <Notice tone="warn">Usa solo una clave propia de tipo client-side. No pegues nunca claves server-side ni credenciales de tu cuenta.</Notice>
            </>
          )}
          <div className="flex items-center gap-3">
            <button className="st-btn-primary" disabled={busy} onClick={saveConnection}>
              Guardar y probar
            </button>
            {busy && <Spinner />}
          </div>
        </div>
      </Card>

      {status && (
        <div className={cx('rounded-xl border px-4 py-3 text-[13px] xl:col-span-2', status.ok ? 'border-win/30 bg-win/[0.06] text-win' : 'border-blood-500/30 bg-blood-500/[0.07] text-blood-400')}>{status.msg}</div>
      )}

      <Card title="Auto Accept">
        <Notice tone="warn">
          Auto Accept pulsa el botón oficial <b>«Aceptar»</b> de la interfaz de FACEIT por ti, igual que un clic manual: no toca peticiones, tokens ni la cola. Aun así, la
          automatización de la interfaz puede no estar permitida por las condiciones de FACEIT y tú eres responsable de su uso. Si prefieres no arriesgar, deja la función desactivada y
          usa solo el aviso de partida encontrada.
        </Notice>
        <div className="mt-3">
          <Row title="He leído el aviso" desc="Obligatorio para poder activar Auto Accept.">
            <Toggle label="He leído el aviso" checked={aa.acknowledged} onChange={(v) => update({ autoAccept: { ...aa, acknowledged: v, enabled: v ? aa.enabled : false } })} />
          </Row>
          <Row title="Auto Accept" desc={aa.enabled ? 'Activo: aceptará tras la cuenta atrás (puedes cancelarla).' : 'Desactivado: solo te avisaremos.'}>
            <Toggle label="Auto Accept" disabled={!aa.acknowledged} checked={aa.enabled} onChange={(v) => update({ autoAccept: { ...aa, enabled: v } })} />
          </Row>
          <Row title={`Cuenta atrás: ${aa.delaySeconds} s`} desc="Tiempo para cancelar antes de aceptar.">
            <input type="range" min={0} max={15} value={aa.delaySeconds} onChange={(e) => update({ autoAccept: { ...aa, delaySeconds: Number(e.target.value) } })} className="accent-[#ff6a1f]" aria-label="Cuenta atrás en segundos" />
          </Row>
          <Row title="Notificación de escritorio" desc="Aviso cuando se encuentra partida.">
            <Toggle label="Notificación" checked={aa.notify} onChange={(v) => update({ autoAccept: { ...aa, notify: v } })} />
          </Row>
          <Row title="Sonido" desc="Pitido corto en la pestaña de FACEIT.">
            <Toggle label="Sonido" checked={aa.sound} onChange={(v) => update({ autoAccept: { ...aa, sound: v } })} />
          </Row>
        </div>
      </Card>

      <Card title="Integración y rendimiento">
        <Row title="Panel en perfiles de FACEIT" desc="Muestra SykosTracker al visitar un perfil.">
          <Toggle label="Panel en perfiles" checked={settings.injectProfilePanel} onChange={(v) => update({ injectProfilePanel: v })} />
        </Row>
        <Row title="Lobby Analyzer en salas" desc="Analiza a los 10 jugadores al abrir una sala.">
          <Toggle label="Lobby Analyzer" checked={settings.injectLobbyPanel} onChange={(v) => update({ injectLobbyPanel: v })} />
        </Row>
        <Row title={`Páginas de historial por escaneo PvP: ${settings.pvpPagesPerScan}`} desc="Cada página = 100 partidas = 1 petición.">
          <input type="range" min={1} max={30} value={settings.pvpPagesPerScan} onChange={(e) => update({ pvpPagesPerScan: Number(e.target.value) })} className="accent-[#ff6a1f]" aria-label="Páginas por escaneo" />
        </Row>
        <Row title={`Estadísticas detalladas por escaneo PvP: ${settings.pvpStatsPerScan}`} desc="Partidas compartidas cuyo scoreboard se descarga en cada consulta.">
          <input type="range" min={0} max={100} step={5} value={settings.pvpStatsPerScan} onChange={(e) => update({ pvpStatsPerScan: Number(e.target.value) })} className="accent-[#ff6a1f]" aria-label="Estadísticas por escaneo" />
        </Row>
        <Row title="Vaciar caché" desc="Borra respuestas guardadas e historial PvP descubierto (no borra favoritos ni ajustes).">
          <button className="st-btn-ghost" onClick={() => rpc('cache.clear', {}).then(() => setStatus({ ok: true, msg: 'Caché vaciada.' }))}>
            Vaciar
          </button>
        </Row>
      </Card>
    </div>
  );
}
