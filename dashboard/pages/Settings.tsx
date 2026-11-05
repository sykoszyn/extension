import { useEffect, useState, type ReactNode } from 'react';
import { rpc } from '@shared/rpc';
import type { Settings } from '@shared/types/settings';
import { AutoAcceptSwitch, LanguageSelect, NicknameForm, Toggle } from '../components/Simple';
import { t } from '@shared/i18n';
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
      <Card title={t('set.account')}>
        {settings.myPlayerId && (
          <p className="mb-3 text-[13px] text-fog-400">
            {t('set.linkedAs')} <b className="text-fog-100">{settings.myNickname}</b>
          </p>
        )}
        <NicknameForm settings={settings} update={update} />
        <p className="mt-3 text-[11px] text-fog-500">{t('set.privacy')}</p>
      </Card>

      <Card title={t('lang.label')}>
        <LanguageSelect settings={settings} update={update} className="!w-full !py-2 !text-[13px]" />
      </Card>

      <Card title={t('set.matches')}>
        <AutoAcceptSwitch settings={settings} update={update} />
        {aa.enabled && (
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-fog-400">{t('set.countdown', { n: aa.delaySeconds })}</span>
            <input
              type="range"
              min={0}
              max={15}
              value={aa.delaySeconds}
              onChange={(e) => update({ autoAccept: { ...aa, delaySeconds: Number(e.target.value) } })}
              className="w-40 accent-[#ff6a1f]"
              aria-label={t('set.countdown', { n: aa.delaySeconds })}
            />
          </div>
        )}
        <div className="mt-4 border-t border-white/[0.05] pt-3">
          <Row title={t('set.notify')} desc={t('set.notifyDesc')}>
            <Toggle label={t('set.notify')} checked={aa.notify || aa.sound} onChange={(v) => update({ autoAccept: { ...aa, notify: v, sound: v } })} />
          </Row>
        </div>
      </Card>

      <button className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 text-left text-[13px] font-semibold text-fog-300 hover:bg-white/[0.02]" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
        {t('set.advanced')}
        <span className={cx('transition', advanced && 'rotate-180')}>▾</span>
      </button>

      {advanced && (
        <div className="space-y-4">
          <Card title={t('set.connection')}>
            {api && (
              <p className={cx('mb-3 text-[13px]', api.keySource === 'none' ? 'text-blood-400' : 'text-win')}>
                {api.keySource === 'proxy' && `✓ ${t('set.viaProxy')}`}
                {api.keySource === 'user' && `✓ ${t('set.viaKey')}`}
                {api.keySource === 'none' && t('set.needKey')}
              </p>
            )}
            <label className="block">
              <span className="st-label">{api?.proxyAvailable ? t('set.keyOptional') : t('set.key')}</span>
              <input className="st-input mt-1 font-mono" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              <span className="mt-1 block text-[11px] text-fog-500">
                <a className="text-ember-400 hover:underline" href="https://developers.faceit.com" target="_blank" rel="noreferrer">
                  developers.faceit.com
                </a>{' '}
                → App Studio → API Keys. {t('set.keyHint')}
                {api?.proxyAvailable && ` ${t('set.keyEmpty')}`}
              </span>
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button className="st-btn-primary" disabled={busy} onClick={testConnection}>
                {t('set.saveTest')}
              </button>
              {busy && <Spinner />}
            </div>
            {status && <div className={cx('mt-3 text-[13px]', status.ok ? 'text-win' : 'text-blood-400')}>{status.msg}</div>}
          </Card>

          <Card title={t('set.onFaceit')}>
            <Row title={t('set.profilePanel')} desc={t('set.profilePanelDesc')}>
              <Toggle label={t('set.profilePanel')} checked={settings.injectProfilePanel} onChange={(v) => update({ injectProfilePanel: v })} />
            </Row>
            <Row title={t('set.roomPanel')} desc={t('set.roomPanelDesc')}>
              <Toggle label={t('set.roomPanel')} checked={settings.injectLobbyPanel} onChange={(v) => update({ injectLobbyPanel: v })} />
            </Row>
          </Card>

          <Card title={t('set.performance')}>
            <Row title={t('set.historyPerScan', { n: settings.pvpPagesPerScan * 100 })} desc={t('set.historyPerScanDesc')}>
              <input type="range" min={1} max={30} value={settings.pvpPagesPerScan} onChange={(e) => update({ pvpPagesPerScan: Number(e.target.value) })} className="w-32 accent-[#ff6a1f]" aria-label={t('set.historyPerScanDesc')} />
            </Row>
            <Row title={t('set.statsPerScan', { n: settings.pvpStatsPerScan })} desc={t('set.statsPerScanDesc')}>
              <input type="range" min={0} max={100} step={5} value={settings.pvpStatsPerScan} onChange={(e) => update({ pvpStatsPerScan: Number(e.target.value) })} className="w-32 accent-[#ff6a1f]" aria-label={t('set.statsPerScanDesc')} />
            </Row>
            <Row title={t('set.clearCache')} desc={t('set.clearCacheDesc')}>
              <button className="st-btn-ghost" onClick={() => rpc('cache.clear', {}).then(() => setStatus({ ok: true, msg: t('set.cacheCleared') }))}>
                {t('clear')}
              </button>
            </Row>
          </Card>
          <Notice>{t('notAffiliated')}</Notice>
        </div>
      )}
    </div>
  );
}
