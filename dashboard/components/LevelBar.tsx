import { levelColor } from '@shared/utils/format';
import { levelProgress } from '@shared/utils/levels';
import { t } from '@shared/i18n';

/** Thin progress bar: how far the player is inside their FACEIT level. */
export function LevelBar({ elo, className }: { elo: number | null | undefined; className?: string }) {
  const lp = levelProgress(elo);
  if (!lp) return null;
  const c = levelColor(lp.level);
  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${lp.pct}%`, background: c }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-fog-500">
        {lp.toNext !== null ? (
          <>
            <span>
              <b className="text-fog-100">{lp.toNext}</b> {t('level.toNext', { n: lp.nextLevel ?? '' })}
            </span>
            <span>{t('level.toDrop', { n: lp.aboveFloor + 1 })}</span>
          </>
        ) : (
          <>
            <span>{t('level.max')}</span>
            <span>
              <b className="text-fog-100">+{lp.aboveFloor}</b> {t('level.above10')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
