/**
 * Recharts wrappers with the SykosTracker chart spec:
 *  - categorical pair validated for dark surface + CVD: YOU #e85a12 / THEM #3d9be9
 *  - status (W/L) colours only for results, always paired with a text label
 *  - recessive grid, 2px lines, rounded bar ends, hover tooltip on every chart
 */
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EloSnapshot, MatchStatLine } from '@shared/types/faceit';
import type { TeamStrength } from '@shared/types/analytics';
import { date, fmt, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';

export const SERIES = { you: '#e85a12', them: '#3d9be9' } as const;
const STATUS = { win: '#3ddc97', loss: '#ff5468', none: '#6e7482' };
const AXIS = { stroke: '#3a3f4b', tick: { fill: '#6e7482', fontSize: 11 }, tickLine: false, axisLine: false } as const;
const GRID = { stroke: 'rgba(255,255,255,0.05)', vertical: false } as const;

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-ink-800/95 px-3 py-2 text-[12px] text-fog-100 shadow-xl backdrop-blur">{children}</div>;
}

export function EloChart({ data }: { data: EloSnapshot[] }) {
  const rows = data.map((d) => ({ t: d.t, elo: d.elo }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => new Date(t).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {...AXIS} minTickGap={32} />
        <YAxis domain={['dataMin - 25', 'dataMax + 25']} {...AXIS} width={48} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Tip>
                <div className="text-fog-400">{date(payload[0].payload.t, true)}</div>
                <div className="st-num text-[15px]">{fmt(payload[0].payload.elo)} ELO</div>
              </Tip>
            ) : null
          }
        />
        <Line type="monotone" dataKey="elo" stroke={SERIES.you} strokeWidth={2} dot={rows.length < 24 ? { r: 3, fill: SERIES.you, stroke: '#0c0d10', strokeWidth: 2 } : false} activeDot={{ r: 5, stroke: '#0c0d10', strokeWidth: 2 }} isAnimationActive />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** K/D per match, oldest → newest left to right; bar tint = result (with tooltip label). */
export function FormChart({ lines }: { lines: MatchStatLine[] }) {
  const rows = [...lines].reverse().map((l, i) => ({ i: i + 1, kd: l.kd, win: l.win, map: l.map, adr: l.adr, kills: l.kills, deaths: l.deaths, t: l.finishedAt }));
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={3}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="i" {...AXIS} interval={0} tick={false} height={6} />
        <YAxis {...AXIS} width={36} tickFormatter={(v: number) => v.toFixed(1)} />
        <ReferenceLine y={1} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload;
            if (!p) return null;
            return (
              <Tip>
                <div className="text-fog-400">
                  {mapLabel(p.map)} · {date(p.t)}
                </div>
                <div className="mt-0.5 font-semibold" style={{ color: p.win === null ? STATUS.none : p.win ? STATUS.win : STATUS.loss }}>
                  {p.win === null ? 'Sin resultado' : p.win ? 'Victoria' : 'Derrota'}
                </div>
                <div className="st-num">
                  K/D {ratio(p.kd)} · {fmt(p.kills)}/{fmt(p.deaths)} · ADR {fmt(p.adr, 1)}
                </div>
              </Tip>
            );
          }}
        />
        <Bar dataKey="kd" radius={[4, 4, 0, 0]} maxBarSize={22}>
          {rows.map((r) => (
            <Cell key={r.i} fill={r.win === null ? STATUS.none : r.win ? STATUS.win : STATUS.loss} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Component-by-component SPI comparison (0–100 normalised scores). */
export function StrengthChart({ you, them, youLabel = 'Your team', themLabel = 'Enemy team' }: { you: TeamStrength; them: TeamStrength; youLabel?: string; themLabel?: string }) {
  const rows = you.components.map((c) => ({
    label: c.label,
    you: c.score,
    them: them.components.find((x) => x.key === c.key)?.score ?? null,
    rawYou: c.raw,
    rawThem: them.components.find((x) => x.key === c.key)?.raw ?? null,
  }));
  return (
    <ResponsiveContainer width="100%" height={rows.length * 44 + 40}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }} barGap={2} barCategoryGap={10}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} {...AXIS} />
        <YAxis type="category" dataKey="label" {...AXIS} width={128} />
        <Legend
          content={() => (
            <div className="flex justify-center gap-4 pt-1 text-[12px] text-fog-300">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES.you }} />{youLabel}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES.them }} />{themLabel}</span>
            </div>
          )}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload;
            if (!p) return null;
            const f = (v: number | null) => (v === null ? '—' : Math.abs(v) < 5 ? ratio(v) : fmt(v, 1));
            return (
              <Tip>
                <div className="mb-1 font-semibold">{p.label}</div>
                <div>
                  <span style={{ color: SERIES.you }}>●</span> {youLabel}: {fmt(p.you, 1)} pts (valor {f(p.rawYou)})
                </div>
                <div>
                  <span style={{ color: SERIES.them }}>●</span> {themLabel}: {fmt(p.them, 1)} pts (valor {f(p.rawThem)})
                </div>
              </Tip>
            );
          }}
        />
        <Bar name={youLabel} dataKey="you" fill={SERIES.you} radius={[0, 4, 4, 0]} maxBarSize={12} />
        <Bar name={themLabel} dataKey="them" fill={SERIES.them} radius={[0, 4, 4, 0]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
