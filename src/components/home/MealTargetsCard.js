'use client';

import { useState } from 'react';
import { UtensilsCrossed, Sun, Moon, Flame } from 'lucide-react';

const MEAL_CONFIG = [
  { key: 'breakfast', label: 'Breakfast', accent: 'green', icon: Sun, frac: 0.30 },
  { key: 'lunch', label: 'Lunch', accent: 'blue', icon: UtensilsCrossed, frac: 0.35 },
  { key: 'dinner', label: 'Dinner', accent: 'purple', icon: Moon, frac: 0.35 },
];

// Same colours + calorie weighting as WeekMacroChart so the two read alike.
const MACROS = [
  { key: 'protein', label: 'Protein', short: 'P', kcalPerG: 4, bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'carbs', label: 'Carbs', short: 'C', kcalPerG: 4, bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'fat', label: 'Fat', short: 'F', kcalPerG: 9, bar: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
];

const ICON_BORDER = {
  green: 'border-emerald-200 dark:border-emerald-800 text-emerald-600',
  blue: 'border-blue-200 dark:border-blue-800 text-blue-600',
  purple: 'border-violet-200 dark:border-violet-800 text-violet-600',
};

function MealRow({ meal, totals, targets }) {
  // Tap-to-pin so the details are reachable on touch screens; on desktop the
  // CSS group-hover does the work.
  const [pinned, setPinned] = useState(false);
  const Icon = meal.icon;

  const targetG = {
    protein: Math.round((targets?.proteinG ?? 0) * meal.frac),
    carbs: Math.round((targets?.carbsG ?? 0) * meal.frac),
    fat: Math.round((targets?.fatG ?? 0) * meal.frac),
  };
  const targetKcal = MACROS.reduce((s, m) => s + targetG[m.key] * m.kcalPerG, 0);

  const consumedG = {
    protein: Math.round(totals.protein ?? 0),
    carbs: Math.round(totals.carbs ?? 0),
    fat: Math.round(totals.fat ?? 0),
  };
  const consumedKcal = MACROS.reduce((s, m) => s + (totals[m.key] ?? 0) * m.kcalPerG, 0);
  const isEmpty = consumedKcal <= 0;

  // Bar scale = the meal's calorie budget. If the meal goes over budget we
  // scale the segments down so the bar stays full but keeps its proportions.
  const scale = Math.max(targetKcal, consumedKcal, 1);
  const pct = targetKcal > 0 ? Math.min(Math.round((consumedKcal / targetKcal) * 100), 999) : 0;

  const handleClick = () => {
    if (isEmpty) {
      // Nothing logged yet → jump to this meal's column in the daily log below.
      const el = document.getElementById(`daily-log-${meal.key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
      return;
    }
    setPinned((p) => !p);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-expanded={isEmpty ? undefined : pinned}
      aria-label={isEmpty ? `${meal.label}: nothing logged, go to log food` : `${meal.label} macros`}
      className="group cursor-pointer rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/30"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white dark:bg-slate-900 ${ICON_BORDER[meal.accent]}`}>
            <Icon size={13} />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{meal.label}</span>
        </div>
        <span className="font-numeric text-[10px] font-semibold text-slate-400 shrink-0">
          {isEmpty ? `${Math.round(meal.frac * 100)}% of day` : `${Math.round(consumedKcal)} / ${Math.round(targetKcal)} kcal`}
        </span>
      </div>

      {/* One bar, three colours: protein | carbs | fat, sized by calories. */}
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
        {MACROS.map((m) => {
          const kcal = (totals[m.key] ?? 0) * m.kcalPerG;
          const w = (kcal / scale) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={m.key}
              className={`h-full transition-all duration-700 ${m.bar}`}
              style={{ width: `${w}%` }}
            />
          );
        })}
      </div>

      {/* Expands on hover / focus / tap. grid-rows 0fr→1fr animates height. */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          pinned ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        } group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100`}
      >
        <div className="overflow-hidden">
          {isEmpty ? (
            <p className="pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Nothing logged yet — click to log food
            </p>
          ) : (
            <div className="pt-2 grid grid-cols-3 gap-1.5">
              {MACROS.map((m) => (
                <div
                  key={m.key}
                  className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 py-1"
                >
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${m.bar} shrink-0`} />
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">{m.label}</span>
                  </div>
                  <p className={`font-numeric text-[11px] font-bold mt-0.5 ${m.text}`}>
                    {consumedG[m.key]}g
                    <span className="font-semibold text-slate-400"> / {targetG[m.key]}g</span>
                  </p>
                </div>
              ))}
              <p className="col-span-3 text-[10px] font-semibold text-slate-400">
                {pct >= 100 ? 'Meal target reached' : `${Math.max(0, Math.round(targetKcal - consumedKcal))} kcal left`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MealTargetsCard({ breakdown, targets }) {
  const totalsByMeal = {};
  for (const cat of breakdown?.categories ?? []) {
    totalsByMeal[cat.value] = cat.totals;
  }

  return (
    <div className="border rounded-2xl transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-slate-900 dark:to-[#050e22] bg-white border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col h-full min-h-[280px]">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-1.5">
          <Flame size={12} className="text-amber-500" /> Meal Targets
        </p>
        <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
          {MACROS.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${m.bar}`} />
              {m.short}
            </span>
          ))}
        </span>
      </div>

      <div className="mt-2.5 flex flex-col gap-2.5 flex-1">
        {MEAL_CONFIG.map((meal) => (
          <MealRow
            key={meal.key}
            meal={meal}
            totals={totalsByMeal[meal.key] ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }}
            targets={targets}
          />
        ))}
      </div>
    </div>
  );
}
