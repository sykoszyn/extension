import { useEffect, useState, type ReactNode } from 'react';
import { rpc } from '@shared/rpc';
import type { Settings } from '@shared/types/settings';
import { AutoAcceptSwitch, NicknameForm, Toggle } from '../components/Simple';
import { Card, Notice, Spinner, cx } from '../components/ui';

export { Toggle };

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

/** Settings: the essentials up front, everything else under "Opciones avanzadas". */
export function SettingsPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => Promise<void> }) {
  const [api, setApi] = useState<{ keySource: 'user' | 'proxy' | 'none'; proxyAvailable: boolean } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [key, setKey] = useState(settings.faceitApiKey);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const aa = settings.autoAccept;
  useEffect(() => setKey(settings.faceitApiKey), [settings.faceitApiKey]);

  useEffect(() => {
    rpc('api.status', {})
      .then((s) => {
        setApi(s);
        if (s.keySource === 'none') setAdvanced(true); // no server → the key field must be visible
      })
      .catch(() => setApi(null));
  }, []);

  const testConnection = async () => {
    setBusy(true);
    setStatus(null);
    await update({ faceitApiKey: key.trim().replace(/^Bearer\s+/i, '') });
    setApi(await rpc('api.status', {}).catch(() => null));
    const r = await rpc('api.test', {}).catch((e) => ({ ok: false, message: String(e.message) }));
    setStatus({ ok: r.ok, msg: r.message });
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card title="Tu cuenta">
        {settings.myPlayerId && (
          <p className="mb-3 text-[13px] text-fog-400">
            Vinculado como <b className="text-fog-100">{settings.myNickname}</b>. Puedes cambiarlo cuando quieras.
          </p>
        )}
        <NicknameForm settings={settings} update={update} />
        <p className="mt-3 text-[11px] text-fog-500">Solo se guarda tu nickname, en este navegador. Nunca contraseñas ni cookies.</p>
      </Card>

      <Card title="Partidas">
        <AutoAcceptSwitch settings={settings} update={update} />
        {aa.enabled && (
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-fog-400">Cuenta atrás: {aa.delaySeconds} s</span>
            <input
              type="range"
              min={0}
              max={15}
              value={aa.delaySeconds}
              onChange={(e) => update({ autoAccept: { ...aa, delaySeconds: Number(e.target.value) } })}
              className="w-40 accent-[#ff6a1f]"
              aria-label="Cuenta atrás en segundos"
            />
          </div>
        )}
        <div className="mt-4 border-t border-white/[0.05] pt-3">
          <Row title="Avisarme cuando haya partida" desc="Notificación y sonido, aunque no uses Auto-aceptar.">
            <Toggle label="Avisarme" checked={aa.notify || aa.sound} onChange={(v) => update({ autoAccept: { ...aa, notify: v, sound: v } })} />
          </Row>
        </div>
      </Card>

      <button className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 text-left text-[13px] font-semibold text-fog-300 hover:bg-white/[0.02]" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
        Opciones avanzadas
        <span className={cx('transition', advanced && 'rotate-180')}>▾</span>
      </button>

      {advanced && (
        <div className="space-y-4">
          <Card title="Conexión con FACEIT">
            {api && (
              <p className={cx('mb-3 text-[13px]', api.keySource === 'none' ? 'text-blood-400' : 'text-win')}>
                {api.keySource === 'proxy' && '✓ Usando el servidor de SykosTracker. No necesitas clave.'}
                {api.keySource === 'user' && '✓ Usando tu propia API key, directamente con FACEIT.'}
                {api.keySource === 'none' && 'Esta versión no incluye servidor: necesitas tu propia API key de FACEIT.'}
              </p>
            )}
            <label className="block">
              <span className="st-label">{api?.proxyAvailable ? 'Tu propia API key (opcional)' : 'Tu FACEIT API key'}</span>
              <input className="st-input mt-1 font-mono" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <span className="mt-1 block text-[11px] text-fog-500">
                De{' '}
                <a className="text-ember-400 hover:underline" href="https://developers.faceit.com" target="_blank" rel="noreferrer">
                  developers.faceit.com
                </a>{' '}
                → App Studio → API Keys. Es secreta: se guarda solo en este navegador.{api?.proxyAvailable && ' Déjala vacía para usar el servidor.'}
              </span>
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button className="st-btn-primary" disabled={busy} onClick={testConnection}>
                Guardar y probar
              </button>
              {busy && <Spinner />}
            </div>
            {status && <div className={cx('mt-3 text-[13px]', status.ok ? 'text-win' : 'text-blood-400')}>{status.msg}</div>}
          </Card>

          <Card title="En FACEIT">
            <Row title="Panel en perfiles" desc="Estadísticas y VS tú al abrir un perfil.">
              <Toggle label="Panel en perfiles" checked={settings.injectProfilePanel} onChange={(v) => update({ injectProfilePanel: v })} />
            </Row>
            <Row title="Análisis de la sala" desc="Los 10 jugadores al entrar en una partida.">
              <Toggle label="Análisis de la sala" checked={settings.injectLobbyPanel} onChange={(v) => update({ injectLobbyPanel: v })} />
            </Row>
          </Card>

          <Card title="Rendimiento">
            <Row title={`Historial por búsqueda: ${settings.pvpPagesPerScan * 100} partidas`} desc="Cuánto historial se revisa cada vez en Player vs Player.">
              <input type="range" min={1} max={30} value={settings.pvpPagesPerScan} onChange={(e) => update({ pvpPagesPerScan: Number(e.target.value) })} className="w-32 accent-[#ff6a1f]" aria-label="Historial por búsqueda" />
            </Row>
            <Row title={`Detalles por búsqueda: ${settings.pvpStatsPerScan}`} desc="Partidas en común de las que se descarga el scoreboard.">
              <input type="range" min={0} max={100} step={5} value={settings.pvpStatsPerScan} onChange={(e) => update({ pvpStatsPerScan: Number(e.target.value) })} className="w-32 accent-[#ff6a1f]" aria-label="Detalles por búsqueda" />
            </Row>
            <Row title="Vaciar caché" desc="Borra datos guardados (no borra tu nick ni favoritos).">
              <button className="st-btn-ghost" onClick={() => rpc('cache.clear', {}).then(() => setStatus({ ok: true, msg: 'Caché vaciada.' }))}>
                Vaciar
              </button>
            </Row>
          </Card>
          <Notice>SykosTracker no está afiliado a FACEIT. Datos de la FACEIT Data API oficial.</Notice>
        </div>
      )}
    </div>
  );
}
