import { handleFromUrl, LINKS } from '@shared/links';
import { cx } from './ui';
import { t } from '@shared/i18n';

/** Follow / donate links from sykos.config.json. Renders nothing if none are set. */
export function CreatorLinks({ className, compact }: { className?: string; compact?: boolean }) {
  if (!LINKS.twitter && !LINKS.donate) return null;
  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] font-semibold text-fog-300 transition hover:border-white/20 hover:text-fog-100';
  return (
    <div className={cx('flex flex-wrap items-center gap-2', compact ? 'justify-center' : '', className)}>
      {LINKS.twitter && (
        <a className={btn} href={LINKS.twitter} target="_blank" rel="noreferrer" title={t('links.follow')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {handleFromUrl(LINKS.twitter)}
        </a>
      )}
      {LINKS.donate && (
        <a className={cx(btn, 'border-ember-500/40 text-ember-300 hover:text-ember-200')} href={LINKS.donate} target="_blank" rel="noreferrer" title={t('links.support')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4C11.8 6.1 13.2 5 15.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z" />
          </svg>
          {t('links.donate')}
        </a>
      )}
    </div>
  );
}
