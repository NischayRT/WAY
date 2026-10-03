'use client';
​
import { useEffect, useMemo, useState } from 'react';
​
/** Round up to a readable axis ceiling. */
function niceCeil(value) {
  if (value <= 0) return 1;
  const step = value > 4000 ? 1000 : value > 1500 ? 500 : value > 400 ? 100 : value > 80 ? 50 : 10;
  return Math.ceil(value / step) * step;
}
​
function formatK(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(Math.round(n));
}
​
/**
 * Single-macro bar chart with a target line and an average line.
 *
 * Alignment contract: a fixed-width axis gutter (`w-7`) is shared by the plot
 * row and the label row, and the tick labels and gridlines are positioned from
 * the same `top` percentages. That is what keeps "0" on the baseline and each
 * day label centred under its bar.
 *
 * @param data      [{ dayLabel, dateLabel, value }]
 * @param barClass  literal Tailwind `bg-*` class (never derived at runtime, or
 *                  Tailwind's scanner won't emit it)
 * @param lineClass literal Tailwind `border-*` class for the average line
 */
export default function MacroBarChart({
  title,
  unit,
  data,
  target,
  barClass = 'bg-slate-400',
  lineClass = 'border-slate-400',
  textClass = 'text-slate-700 dark:text-slate-200',
}) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
​
  // rAF so the browser paints the zero-height state before transitioning up.
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [data]);
​
  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e) => e.key === 'Escape' && setActiveIndex(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex]);
​
  const model = useMemo(() => {
    const values = data.map((d) => d.value ?? 0);
    const logged = values.filter((v) => v > 0);
    const maxScale = niceCeil(Math.max(target * 1.15, ...values, 1));
​
    return {
      maxScale,
      ticks: [maxScale, maxScale / 2, 0],
      // Average over logged days only — counting empty days as zero would
      // report a diet that was never eaten.
      avg: logged.length ? logged.reduce((a, v) => a + v, 0) / logged.length : 0,
      loggedCount: logged.length,
    };
  }, [data, target]);
​
  const { maxScale, ticks, avg, loggedCount } = model;
  const targetPct = target > 0 ? Math.min((target / maxScale) * 100, 100) : null;
  const avgPct = avg > 0 ? Math.min((avg / maxScale) * 100, 100) : null;
  const active = activeIndex === null ? null : data[activeIndex];
​
  // Keep roughly 7 labels regardless of range, so 30 days never crams.
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
​
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading truncate text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="shrink-0 font-numeric text-[10px] text-slate-400">
          avg{' '}
          <span className={`font-bold ${textClass}`}>
            {formatK(avg)}
            {unit}
          </span>
          {target > 0 && <> / {formatK(target)}</>}
        </span>
      </div>
​
      <div className="relative mt-2">
        {/* Plot row: axis gutter + plot area */}
        <div className="flex h-28">
          <div className="relative w-7 shrink-0">
            {ticks.map((t, i) => (
              <span
                key={t}
                className="absolute right-1 -translate-y-1/2 font-numeric text-[8px] tabular-nums text-slate-400"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              >
                {formatK(t)}
              </span>
            ))}
          </div>
​
          <div className="relative min-w-0 flex-1" onMouseLeave={() => setActiveIndex(null)}>
            {/* Gridlines on the same offsets as the ticks */}
            {ticks.map((t, i) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t border-slate-200/70 dark:border-slate-800"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
​
            {/* Target line */}
            {targetPct !== null && (
              <span
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-400/70 transition-all duration-700 ease-out"
                style={{ bottom: mounted ? `${targetPct}%` : '0%' }}
              />
            )}
​
            {/* Average line — the statistical reference, drawn over the target */}
            {avgPct !== null && (
              <span
                className={`pointer-events-none absolute inset-x-0 z-10 border-t border-dotted opacity-80 transition-all duration-700 ease-out ${lineClass}`}
                style={{ bottom: mounted ? `${avgPct}%` : '0%' }}
              />
            )}
​
            <div className="absolute inset-0 flex items-end gap-px">
              {data.map((d, i) => {
                const heightPct = Math.min(((d.value ?? 0) / maxScale) * 100, 100);
                const isActive = activeIndex === i;
                const dimmed = activeIndex !== null && !isActive;
​
                return (
                  <div
                    key={d.dateLabel ?? i}
                    className="flex h-full min-w-0 flex-1 cursor-pointer items-end"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => setActiveIndex((p) => (p === i ? null : i))}
                  >
                    {d.value > 0 ? (
                      <span
                        className={`mx-auto w-full max-w-[16px] rounded-t-sm transition-[height,opacity] duration-700 ease-out ${barClass} ${
                          dimmed ? 'opacity-40' : 'opacity-100'
                        }`}
                        style={{
                          height: mounted ? `${heightPct}%` : '0%',
                          transitionDelay: `${Math.min(i * 25, 300)}ms`,
                        }}
                      />
                    ) : (
                      // Stub marks an unlogged day as distinct from a zero-calorie day.
                      <span className="mx-auto h-[3px] w-full max-w-[16px] rounded-sm bg-slate-200 dark:bg-slate-800" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
​
        {/* Label row reuses the same gutter so labels line up with bars */}
        <div className="mt-1 flex">
          <span className="w-7 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-px overflow-hidden">
            {data.map((d, i) => (
              <span
                key={d.dateLabel ?? i}
                className="min-w-0 flex-1 truncate text-center font-numeric text-[8px] leading-none text-slate-400"
              >
                {i % labelEvery === 0 ? d.dayLabel : ''}
              </span>
            ))}
          </div>
        </div>
​
        {/* Tooltip */}
        {active && (
          <div
            className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2"
            style={{ left: `calc(1.75rem + ${((activeIndex + 0.5) / data.length) * 100}%)` }}
          >
            <div className="whitespace-nowrap rounded-lg border border-slate-200/80 bg-white/95 px-1.5 py-1 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
              <span className="block font-numeric text-[8px] leading-none text-slate-400">
                {active.dateLabel}
              </span>
              <span className="mt-0.5 block font-numeric text-[10px] font-bold leading-none text-slate-900 dark:text-white">
                {active.value > 0 ? `${formatK(active.value)}${unit}` : 'No log'}
              </span>
            </div>
          </div>
        )}
      </div>
​
      {loggedCount === 0 && (
        <p className="mt-1 text-center text-[9px] text-slate-400">Nothing logged in this window.</p>
      )}
    </div>
  );
}