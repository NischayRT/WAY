'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { ui } from '@/lib/ui';

const PAGE = 10;

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Weigh-in history, newest first, with the delta against the previous entry.
 *
 * @param entries [{ logged_at, weight_kg }] ascending
 */
export default function WeightHistoryList({ entries }) {
  const [shownCount, setShownCount] = useState(PAGE);

  // Compute deltas in ascending order (each vs the one before it), then flip
  // so the newest reads first.
  const rows = useMemo(() => {
    const asc = entries.map((e, i) => {
      const weight = Number(e.weight_kg);
      const prev = i > 0 ? Number(entries[i - 1].weight_kg) : null;
      return {
        date: e.logged_at,
        weight,
        delta: prev === null ? null : weight - prev,
      };
    });
    return asc.reverse();
  }, [entries]);

  const visible = rows.slice(0, shownCount);
  const hasMore = shownCount < rows.length;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className={ui.subheading}>History</h2>
        <span className="font-numeric text-[10px] text-slate-400">
          {rows.length} weigh-ins
        </span>
      </div>

      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((row, i) => {
          const flat = row.delta === null || Math.abs(row.delta) < 0.05;
          const DeltaIcon = flat ? Minus : row.delta > 0 ? ArrowUp : ArrowDown;
          const deltaTone = flat
            ? 'text-slate-400'
            : row.delta > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400';

          return (
            <li
              key={row.date}
              className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-1"
              // Staggered fade so a long list doesn't snap in all at once.
              style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
            >
              <span className="flex items-center gap-2 min-w-0">
                {i === 0 && (
                  <span className="shrink-0 rounded-full bg-slate-900 dark:bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white dark:text-slate-900">
                    Latest
                  </span>
                )}
                <span className="truncate font-numeric text-slate-500 dark:text-slate-400">
                  {formatDate(row.date)}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-3">
                {row.delta !== null && (
                  <span className={`flex items-center gap-0.5 font-numeric text-[11px] font-semibold ${deltaTone}`}>
                    <DeltaIcon size={11} />
                    {flat ? '0.0' : Math.abs(row.delta).toFixed(1)}
                  </span>
                )}
                <span className="font-numeric font-bold text-slate-900 dark:text-white">
                  {row.weight.toFixed(1)} kg
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShownCount((c) => c + PAGE)}
          className={`${ui.btnSecondary} mt-3 w-full justify-center py-1.5 text-xs`}
        >
          <ChevronDown size={14} />
          Show {Math.min(PAGE, rows.length - shownCount)} more
        </button>
      )}
    </div>
  );
}
