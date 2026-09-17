'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

/* Bottom-to-top stack order. Segment heights are derived from each macro's
   calorie contribution (protein/carbs 4 kcal/g, fat 9 kcal/g) rather than
   raw grams — stacking grams would make 20g of fat look the same as 20g of
   carbs when it carries more than double the energy. */
const SEGMENTS = [
  { key: 'protein', label: 'Protein', kcalPerG: 4, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'carbs', label: 'Carbs', kcalPerG: 4, bar: 'bg-blue-500', dot: 'bg-blue-500' },
  { key: 'fat', label: 'Fat', kcalPerG: 9, bar: 'bg-purple-500', dot: 'bg-purple-500' },
];

function formatK(n) {
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n));
}

/**
 * Weekly stacked macro chart for the home screen.
 *
 * Reads the `days` + `weekBreakdowns` the home page already computes, so it
 * adds no queries — it's pure presentation over data that's already on the
 * client.
 *
 * @param {Array<{date:string, dayLabel:string, isToday:boolean}>} days
 * @param {Record<string, {overallTotals:{calories:number, protein:number, carbs:number, fat:number}}>} weekBreakdowns
 * @param {number} targetCalories - draws the reference line
 */
export default function WeekMacroChart({ days = [], weekBreakdowns = {}, targetCalories = 0 }) {
  const [activeDate, setActiveDate] = useState(null);

  const { bars, maxScale, ticks, avgKcal, loggedCount, pctOfTarget } = useMemo(() => {
    const bars = days.map((day) => {
      const totals = weekBreakdowns[day.date]?.overallTotals ?? {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };

      const parts = SEGMENTS.map((s) => ({
        ...s,
        grams: Math.round(totals[s.key] ?? 0),
        kcal: (totals[s.key] ?? 0) * s.kcalPerG,
      }));

      // Sum of macro-derived kcal, so the segments always add up to the bar
      // height exactly. `totals.calories` is the logged value and can differ
      // slightly from 4/4/9 arithmetic, so it's shown separately, not stacked.
      const stackKcal = parts.reduce((acc, p) => acc + p.kcal, 0);

      return {
        date: day.date,
        dayLabel: day.dayLabel,
        isToday: day.isToday,
        parts,
        stackKcal,
        loggedKcal: Math.round(totals.calories ?? 0),
        hasLogs: stackKcal > 0,
      };
    });

    const peak = Math.max(...bars.map((b) => b.stackKcal), targetCalories || 0, 1);
    // Round the ceiling up to a clean step so the axis labels read nicely.
    const step = peak > 4000 ? 1000 : peak > 2000 ? 500 : 250;
    const maxScale = Math.ceil((peak * 1.08) / step) * step;

    const logged = bars.filter((b) => b.hasLogs);
    const avgKcal = logged.length
      ? Math.round(logged.reduce((acc, b) => acc + b.stackKcal, 0) / logged.length)
      : 0;

    return {
      bars,
      maxScale,
      ticks: [maxScale, maxScale / 2, 0],
      avgKcal,
      loggedCount: logged.length,
      pctOfTarget: targetCalories > 0 ? Math.round((avgKcal / targetCalories) * 100) : null,
    };
  }, [days, weekBreakdowns, targetCalories]);

  // Clear the tooltip on Escape — on touch there's no pointer-leave.
  useEffect(() => {
    if (!activeDate) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setActiveDate(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDate]);

  const active = bars.find((b) => b.date === activeDate) ?? null;
  const targetLinePct = maxScale > 0 && targetCalories > 0 ? (targetCalories / maxScale) * 100 : null;
  const anyLogs = loggedCount > 0;

  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            Last 7 Days
          </h4>
          {anyLogs ? (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-numeric text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                {avgKcal.toLocaleString('en-IN')}
              </span>
              <span className="font-numeric text-[10px] font-bold text-slate-400">kcal/day</span>
            </div>
          ) : (
            <p className="mt-0.5 text-[11px] text-slate-400">Nothing logged yet</p>
          )}
          {anyLogs && pctOfTarget !== null && (
            <p className="mt-0.5 font-numeric text-[10px] text-slate-400 dark:text-slate-500">
              {pctOfTarget}% of target · {loggedCount}/{bars.length} days logged
            </p>
          )}
        </div>

        <Link
          href="/trends"
          className="group inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
        >
          See all
          <ChevronRight
            size={12}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {/* --- Chart -------------------------------------------------------- */}
      {anyLogs ? (
        <div className="relative mt-3 flex min-h-0 flex-1 gap-2">
          {/* y-axis */}
          <div className="flex w-7 shrink-0 flex-col justify-between py-0.5 font-numeric text-[9px] text-slate-400 dark:text-slate-600">
            {ticks.map((t) => (
              <span key={t} className="leading-none">
                {formatK(t)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Target reference line, positioned as a % of the scale. */}
            {targetLinePct !== null && targetLinePct <= 100 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-400/50 dark:border-slate-500/50"
                style={{ bottom: `calc(${targetLinePct}% + 1.25rem)` }}
              >
                <span className="absolute -top-3.5 right-0 font-numeric text-[8px] text-slate-400 dark:text-slate-500">
                  target
                </span>
              </div>
            )}

            <div className="flex h-full items-end gap-1 sm:gap-1.5">
              {bars.map((bar) => {
                const isActive = activeDate === bar.date;
                const dimmed = activeDate !== null && !isActive;
                const heightPct = maxScale > 0 ? (bar.stackKcal / maxScale) * 100 : 0;

                return (
                  <div
                    key={bar.date}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    onMouseEnter={() => setActiveDate(bar.date)}
                    onMouseLeave={() => setActiveDate(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDate((prev) => (prev === bar.date ? null : bar.date))}
                      aria-label={`${bar.dayLabel}: ${bar.loggedKcal} kilocalories`}
                      className="group relative flex w-full flex-1 cursor-pointer flex-col justify-end"
                    >
                      {/* Ghost track: shows the day's unfilled headroom so
                          empty days still have a tappable footprint. */}
                      <span
                        className={`absolute inset-x-0 bottom-0 top-0 rounded-md transition-colors duration-200 ${
                          isActive ? 'bg-slate-200/60 dark:bg-slate-800/60' : 'bg-transparent'
                        }`}
                      />

                      {/* The stack. column-reverse so SEGMENTS order reads
                          bottom-up (protein at the base). */}
                      <span
                        className={`relative flex w-full flex-col-reverse overflow-hidden rounded-md transition-all duration-300 ease-out ${
                          dimmed ? 'opacity-40' : 'opacity-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {bar.parts.map((part) => {
                          const sharePct =
                            bar.stackKcal > 0 ? (part.kcal / bar.stackKcal) * 100 : 0;
                          if (sharePct <= 0) return null;
                          return (
                            <span
                              key={part.key}
                              className={`w-full ${part.bar} transition-all duration-500 ease-out`}
                              style={{ height: `${sharePct}%` }}
                            />
                          );
                        })}
                      </span>

                      {!bar.hasLogs && (
                        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                      )}
                    </button>

                    <span
                      className={`mt-1.5 w-full truncate text-center font-numeric text-[9px] leading-none transition-colors ${
                        isActive || bar.isToday
                          ? 'font-bold text-slate-700 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {bar.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Tooltip. Anchored to the hovered column via flex order so it
                never escapes the panel on the first/last day. */}
            {active && (
              <div className="pointer-events-none absolute inset-x-0 -top-1 z-20 flex justify-center">
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2 py-1 shadow-lg backdrop-blur-sm">
                  <div className="flex items-baseline gap-1">
                    <span className="font-numeric text-xs font-bold text-slate-900 dark:text-white leading-none">
                      {active.loggedKcal.toLocaleString('en-IN')}
                    </span>
                    <span className="font-numeric text-[9px] text-slate-400">kcal</span>
                  </div>
                  {active.hasLogs ? (
                    <div className="mt-1 flex items-center gap-2">
                      {active.parts.map((p) => (
                        <span key={p.key} className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                          <span className="font-numeric text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                            {p.grams}g
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="mt-0.5 block text-[9px] text-slate-400">No log</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- Empty state ------------------------------------------------ */
        <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/70 dark:border-slate-700/60 px-3 py-6 text-center">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            No food logged this past week
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Log a meal and your weekly macro split shows up here.
          </p>
        </div>
      )}

      {/* --- Legend ------------------------------------------------------- */}
      <div className="mt-2.5 flex items-center justify-center gap-3 border-t border-slate-200/70 dark:border-slate-800 pt-2">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              {s.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
