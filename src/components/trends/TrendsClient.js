'use client';
​
import { useMemo, useState } from 'react';
import { ui } from '@/lib/ui';
import MacroBarChart from './MacroBarChart';
​
const RANGES = [7, 14, 30];
​
/* Colour classes are written out in full so Tailwind's scanner can see them.
   Building them dynamically (`bg-${c}-500`) silently yields colourless bars. */
const MACROS = [
  {
    key: 'protein',
    label: 'Protein',
    bar: 'bg-emerald-500',
    line: 'border-emerald-500',
    text: ui.macroText.protein,
    targetKey: 'proteinG',
  },
  {
    key: 'carbs',
    label: 'Carbs',
    bar: 'bg-blue-500',
    line: 'border-blue-500',
    text: ui.macroText.carbs,
    targetKey: 'carbsG',
  },
  {
    key: 'fat',
    label: 'Fat',
    bar: 'bg-violet-500',
    line: 'border-violet-500',
    text: ui.macroText.fat,
    targetKey: 'fatG',
  },
];
​
/**
 * Trends view. The server sends the widest window (30 days) in one query and
 * this component slices it, so switching range costs no round trip.
 *
 * @param days    ascending [{ date, dayLabel, dateLabel, calories, protein, carbs, fat }]
 * @param targets resolved daily targets
 */
export default function TrendsClient({ days, targets }) {
  const [range, setRange] = useState(7);
​
  const windowDays = useMemo(() => days.slice(-range), [days, range]);
​
  const stats = useMemo(() => {
    const logged = windowDays.filter((d) => d.calories > 0);
​
    const avgCalories = logged.length
      ? Math.round(logged.reduce((a, d) => a + d.calories, 0) / logged.length)
      : 0;
​
    // Days landing within ±10% of the calorie target. Kept separate from the
    // average, because a clean mean can hide alternating 1,200 / 3,200 days.
    const onTarget = targets.targetCalories
      ? logged.filter(
          (d) => Math.abs(d.calories - targets.targetCalories) <= targets.targetCalories * 0.1
        ).length
      : 0;
​
    // Longest run of consecutive logged days, scanned newest-first.
    let streak = 0;
    for (let i = windowDays.length - 1; i >= 0; i -= 1) {
      if (windowDays[i].calories > 0) streak += 1;
      else break;
    }
​
    return { avgCalories, onTarget, streak, loggedCount: logged.length };
  }, [windowDays, targets]);
​
  const pctOfTarget = targets.targetCalories
    ? Math.round((stats.avgCalories / targets.targetCalories) * 100)
    : null;
​
  return (
    <div className="space-y-4">
      {/* Range switcher */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-numeric text-[11px] text-slate-400">
          {stats.loggedCount} of {range} days logged
        </p>
        <div className="flex gap-1 rounded-xl border border-slate-200/90 bg-white p-0.5 dark:border-slate-700/80 dark:bg-slate-900/90">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-2.5 py-1 font-numeric text-[11px] font-bold transition-colors ${
                range === r
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>
​
      {/* Three headline numbers — deliberately not more than three */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat
          label="Avg intake"
          value={stats.avgCalories.toLocaleString('en-IN')}
          unit="kcal"
          sub={pctOfTarget === null ? 'logged days only' : `${pctOfTarget}% of target`}
          tone={ui.macroText.calories}
        />
        <Stat
          label="On target"
          value={stats.onTarget}
          unit={`/ ${stats.loggedCount}`}
          sub="within ±10% of goal"
        />
        <Stat label="Streak" value={stats.streak} unit="days" sub="consecutive logs" />
      </div>
​
      {/* Rigid 2 x 2 from sm up, stacked below it. Tailwind's grid-cols-2
         resolves to repeat(2, minmax(0, 1fr)), and the min-w-0 on each cell
         keeps a chart's intrinsic width from widening its column — that
         widening is what pushed cards onto their own rows (the 1/2/1 break).
         items-stretch makes both cards in a row share the taller height. */}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
        <div className={`${ui.card} min-w-0`}>
          <MacroBarChart
            title="Calories"
            unit=" kcal"
            data={windowDays.map((d) => ({
              dayLabel: d.dayLabel,
              dateLabel: d.dateLabel,
              value: d.calories,
            }))}
            target={targets.targetCalories}
            barClass="bg-amber-500"
            lineClass="border-amber-500"
            textClass={ui.macroText.calories}
          />
        </div>
​
        {MACROS.map((m) => (
          <div key={m.key} className={`${ui.card} min-w-0`}>
            <MacroBarChart
              title={m.label}
              unit="g"
              data={windowDays.map((d) => ({
                dayLabel: d.dayLabel,
                dateLabel: d.dateLabel,
                value: d[m.key],
              }))}
              target={targets[m.targetKey]}
              barClass={m.bar}
              lineClass={m.line}
              textClass={m.text}
            />
          </div>
        ))}
      </div>
​
      <p className="text-center text-[10px] text-slate-400">
        Dotted line = your average · dashed line = target · averages skip unlogged days
      </p>
    </div>
  );
}
​
function Stat({ label, value, unit, sub, tone = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/90">
      <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-numeric text-lg font-black leading-none tracking-tight ${tone}`}>
          {value}
        </span>
        <span className="font-numeric text-[9px] font-bold leading-none text-slate-400">{unit}</span>
      </div>
      <p className="mt-1 truncate font-numeric text-[9px] leading-none text-slate-400">{sub}</p>
    </div>
  );
}
​