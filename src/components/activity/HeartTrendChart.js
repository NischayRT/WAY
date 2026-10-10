'use client';

import { useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';

const W = 600;
const H = 200;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 20;

const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Resting heart rate as a line, with each day's low-high heart rate as a
 * soft bar behind it.
 *
 * @param resting [{ date, value }]  daily resting bpm (null = none)
 * @param low     [{ date, value }]  daily lowest bpm (may be all null for long ranges)
 * @param high    [{ date, value }]  daily highest bpm
 */
export default function HeartTrendChart({ resting = [], low = [], high = [], loading = false }) {
  const [active, setActive] = useState(null);

  const model = useMemo(() => {
    const n = resting.length;
    const vals = [
      ...resting.map((d) => d.value),
      ...low.map((d) => d.value),
      ...high.map((d) => d.value),
    ].filter((v) => v != null);
    if (!n || !vals.length) return null;
    const lo = Math.max(30, Math.floor((Math.min(...vals) - 5) / 10) * 10);
    const hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
    const x = (i) => PAD_L + ((i + 0.5) / n) * (W - PAD_L - PAD_R);
    const y = (v) => PAD_T + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD_T - PAD_B);
    const bw = Math.max(2, ((W - PAD_L - PAD_R) / n) * 0.55);

    // Resting line, broken where a day has no value.
    let path = '';
    let pen = false;
    resting.forEach((d, i) => {
      if (d.value == null) {
        pen = false;
        return;
      }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)} `;
      pen = true;
    });
    const ticks = [lo, Math.round((lo + hi) / 2), hi];
    const hasRange = high.some((d) => d.value != null);
    const r = resting.filter((d) => d.value != null);
    const avg = r.length ? Math.round(r.reduce((a, d) => a + d.value, 0) / r.length) : null;
    return { n, x, y, bw, path, ticks, hasRange, avg, lo, hi };
  }, [resting, low, high]);

  const point = active != null && model ? { date: resting[active]?.date, r: resting[active]?.value, lo: low[active]?.value, hi: high[active]?.value } : null;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          <HeartPulse size={13} className="text-rose-500" /> Heart rate
        </h3>
        <span className="font-numeric text-[11px] text-slate-400">
          {model?.avg ? (
            <>
              avg resting <b className="text-rose-600 dark:text-rose-300">{model.avg} bpm</b>
            </>
          ) : loading ? (
            'Loading…'
          ) : null}
        </span>
      </div>

      <div className="relative mt-2">
        {!model ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
            {loading ? 'Loading heart rate…' : 'No heart rate data in this range.'}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[200px] w-full touch-pan-y select-none"
            preserveAspectRatio="none"
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * W;
              const i = Math.floor(((px - PAD_L) / (W - PAD_L - PAD_R)) * model.n);
              setActive(i >= 0 && i < model.n ? i : null);
            }}
            onPointerLeave={() => setActive(null)}
          >
            {model.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD_L} x2={W - PAD_R} y1={model.y(t)} y2={model.y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
                <text x={PAD_L - 6} y={model.y(t) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {t}
                </text>
              </g>
            ))}
            {model.hasRange &&
              high.map((d, i) =>
                d.value != null && low[i]?.value != null ? (
                  <rect
                    key={d.date}
                    x={model.x(i) - model.bw / 2}
                    width={model.bw}
                    y={model.y(d.value)}
                    height={Math.max(1, model.y(low[i].value) - model.y(d.value))}
                    rx={model.bw / 2}
                    className={active === i ? 'fill-rose-300/70 dark:fill-rose-500/50' : 'fill-rose-200/60 dark:fill-rose-500/20'}
                  />
                ) : null
              )}
            <path d={model.path} fill="none" className="stroke-rose-600 dark:stroke-rose-400" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {active != null && resting[active]?.value != null && (
              <circle cx={model.x(active)} cy={model.y(resting[active].value)} r="4" className="fill-rose-600 stroke-white dark:stroke-slate-900" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        )}

        {point && (
          <div className="pointer-events-none absolute right-2 top-0 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[11px] shadow-md dark:border-slate-700 dark:bg-slate-900/95">
            <b className="text-slate-900 dark:text-white">{fmtDay(point.date)}</b>
            <span className="ml-2 text-rose-600 dark:text-rose-300">resting {point.r ?? '–'}</span>
            {model?.hasRange && (
              <span className="ml-2 text-slate-500">
                {point.lo ?? '–'}-{point.hi ?? '–'} bpm
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-rose-600" /> Resting
        </span>
        {model?.hasRange ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2 rounded bg-rose-200 dark:bg-rose-500/30" /> Day&apos;s low-high
          </span>
        ) : (
          model && <span>Daily low-high shown for ranges up to 3 months</span>
        )}
      </div>
    </div>
  );
}
