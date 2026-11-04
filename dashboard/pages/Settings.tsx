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
  const [api, setApi] = useState<{ keySource: 'user' | 'proxy' | 'none'; proxyAvailable: boolean } | null>(null);
  const [ownKeyOpen, setOwnKeyOpen] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    rpc('api.status', {})
      .then(setApi)
      .catch(() => setApi(null));
  }, []);

  const saveConnection = async () => {
    setBusy(true);
    setStatus(null);
    await update({ faceitApiKey: draft.faceitApiKey.trim().replace(/^Bearer\s+/i, '') });
    setApi(await rpc('api.status', {}).catch(() => null));
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

      <Card title="Conexión con FACEIT">
        <div className="space-y-3">
          {api && (
            <div
              className={cx(
                'rounded-lg border px-3 py-2 text-[13px]',
                api.keySource === 'none' ? 'border-blood-500/30 bg-blood-500/[0.07] text-blood-400' : 'border-win/25 bg-win/[0.05] text-win',
              )}
            >
              {api.keySource === 'proxy' && '✓ Listo. Usando el servidor de SykosTracker: no necesitas ninguna clave, solo tu nickname.'}
              {api.keySource === 'user' && '✓ Usando tu propia API key, directamente con open.faceit.com.'}
              {api.keySource === 'none' && 'Esta versión no incluye servidor: añade tu propia API key de FACEIT abajo.'}
            </div>
          )}
          <p className="text-[12px] text-fog-400">
            FACEIT exige una clave para cualquier consulta. Por defecto SykosTracker usa su propio servidor, que añade la clave sin guardar nada tuyo. Si lo prefieres, puedes
            usar tu propia clave y hablar directamente con FACEIT.
          </p>

          {api?.proxyAvailable && !ownKeyOpen && !draft.faceitApiKey ? (
            <button className="text-[12px] text-ember-400 hover:underline" onClick={() => setOwnKeyOpen(true)}>
              Avanzado: usar mi propia API key (opcional)
            </button>
          ) : (
            <>
              <Field
                label={api?.proxyAvailable ? 'Tu FACEIT API key (opcional)' : 'Tu FACEIT API key'}
                hint={
                  <>
                    Gratis en{' '}
                    <a className="text-ember-400 hover:underline" href="https://developers.faceit.com" target="_blank" rel="noreferrer">
                      developers.faceit.com
                    </a>{' '}
                    → App Studio → tu app → API Keys (tipo <b>Server side</b>). Se guarda solo en este navegador.{api?.proxyAvailable && ' Déjala vacía para usar el servidor de SykosTracker.'}
                  </>
                }
              >
                <input className="st-input font-mono" type="password" autoComplete="off" value={draft.faceitApiKey} onChange={(e) => setDraft({ ...draft, faceitApiKey: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Field>
              <Notice tone="warn">
                Es una clave <b>personal y secreta</b>: SykosTracker solo la guarda en este navegador y solo la envía a <span className="font-mono">open.faceit.com</span>. No la
                compartas. Si crees que se ha filtrado, revócala en App Studio y crea otra.
              </Notice>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button className="st-btn-primary" disabled={busy} onClick={saveConnection}>
              {ownKeyOpen || draft.faceitApiKey || !api?.proxyAvailable ? 'Guardar y probar' : 'Probar conexión'}
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
