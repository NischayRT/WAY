'use client';

import { Flame } from 'lucide-react';

// Concentric macro rings. Uses the same palette as the orbit view
// (protein = emerald, carbs = blue, fat = violet, calories = amber) and the
// app's light/dark surfaces. Only the graphic lives here: the per-macro stats
// strip is rendered by NutritionalOrbitPanel for both views.
const SIZE = 220;
const C = SIZE / 2;
const STROKE = 14;

const RINGS = [
  { k: 'protein', r: 94, track: 'stroke-emerald-100 dark:stroke-emerald-950/70', bar: 'stroke-emerald-500', tip: 'fill-emerald-500' },
  { k: 'carbs', r: 76, track: 'stroke-blue-100 dark:stroke-blue-950/70', bar: 'stroke-blue-500', tip: 'fill-blue-500' },
  { k: 'fat', r: 58, track: 'stroke-violet-100 dark:stroke-violet-950/70', bar: 'stroke-violet-500', tip: 'fill-violet-500' },
];

export default function MacroRings({ consumed = {}, targets = {} }) {
  const vals = {
    protein: [consumed.protein || 0, targets.proteinG || 0],
    carbs: [consumed.carbs || 0, targets.carbsG || 0],
    fat: [consumed.fat || 0, targets.fatG || 0],
  };

  const calC = Math.round(consumed.calories || 0);
  const calT = targets.targetCalories || 0;
  const left = Math.max(0, calT - calC);
  const calPct = calT > 0 ? Math.min(calC / calT, 1) : 0;

  return (
    <div className="flex w-full items-center justify-center select-none">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[230px] h-auto overflow-visible"
        role="img"
        aria-label="Protein, carbs and fat progress rings"
      >
        {RINGS.map(({ k, r, track, bar }) => {
          const [v, t] = vals[k];
          const pct = t > 0 ? Math.min(v / t, 1) : 0;
          const circ = 2 * Math.PI * r;
          return (
            <g key={k} transform={`rotate(-90 ${C} ${C})`}>
              <circle cx={C} cy={C} r={r} fill="none" strokeWidth={STROKE} className={track} />
              <circle
                cx={C}
                cy={C}
                r={r}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                className={`${bar} transition-all duration-700 ease-out`}
                style={{ opacity: pct > 0 ? 1 : 0 }}
              />
            </g>
          );
        })}

        {/* Centre: calories remaining (same info as the orbit centre) */}
        <circle
          cx={C}
          cy={C}
          r={41}
          fill="none"
          strokeWidth={3}
          className="stroke-amber-100 dark:stroke-slate-800"
        />
        <circle
          cx={C}
          cy={C}
          r={41}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 41}
          strokeDashoffset={2 * Math.PI * 41 * (1 - calPct)}
          transform={`rotate(-90 ${C} ${C})`}
          className="stroke-amber-500 transition-all duration-700 ease-out"
        />
        <text x={C} y={C - 12} textAnchor="middle" className="fill-amber-600 dark:fill-amber-400" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em' }}>
          REMAINING
        </text>
        <text x={C} y={C + 8} textAnchor="middle" className="fill-slate-900 dark:fill-white font-numeric" style={{ fontSize: 22, fontWeight: 900 }}>
          {left.toLocaleString('en-IN')}
        </text>
        <text x={C} y={C + 21} textAnchor="middle" className="fill-slate-400 font-numeric" style={{ fontSize: 8.5, fontWeight: 600 }}>
          / {calT.toLocaleString('en-IN')} kcal
        </text>
      </svg>
    </div>
  );
}