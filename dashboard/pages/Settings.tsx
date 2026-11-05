import type { ReactNode } from 'react';
import type { Settings } from '@shared/types/settings';
import { AutoAcceptSwitch, LanguageSelect, NicknameForm, Toggle } from '../components/Simple';
import { t } from '@shared/i18n';
import { Card, Notice } from '../components/ui';

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

/** Settings: account, language and matches. Nothing technical (the FACEIT connection is handled by the extension). */
export function SettingsPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => Promise<void> }) {
  const aa = settings.autoAccept;

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
        <div className="mt-4 border-t border-white/[0.05] pt-3">
          <Row title={t('set.notify')} desc={t('set.notifyDesc')}>
            <Toggle label={t('set.notify')} checked={aa.notify || aa.sound} onChange={(v) => update({ autoAccept: { ...aa, notify: v, sound: v } })} />
          </Row>
        </div>
      </Card>

      <Notice>{t('notAffiliated')}</Notice>
    </div>
  );
}
