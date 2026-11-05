import { levelColor } from '@shared/utils/format';
import { levelProgress } from '@shared/utils/levels';

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
              Faltan <b className="text-fog-100">{lp.toNext}</b> ELO para nivel {lp.nextLevel}
            </span>
            <span>
              −{lp.aboveFloor + 1} para bajar
            </span>
          </>
        ) : (
          <>
            <span>Nivel máximo</span>
            <span>
              <b className="text-fog-100">+{lp.aboveFloor}</b> sobre nivel 10
            </span>
          </>
        )}
      </div>
    </div>
  );
}
