'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Sparkles } from 'lucide-react';

export default function RepeatMealBanner({ selectedDate }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleRepeat = async (mealType = null) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/repeat-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate, mealType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const n = Number(data.count) || 0;
        setStatus(`Copied ${n} item${n === 1 ? '' : 's'} from yesterday!`);
        router.refresh();
        setTimeout(() => setStatus(null), 3500);
      } else {
        setStatus(data.error || 'Failed');
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus('Network error');
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col border rounded-2xl transition-shadow hover:shadow-lg border border-slate-200/90 dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22] bg-white border-slate-200/90/90 shadow-xs h-full min-h-[110px] overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          <RotateCcw size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1 truncate">
            Quick Repeat <Sparkles size={11} className="text-amber-500 shrink-0" />
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">
            Repeat yesterday&apos;s meals
          </p>
        </div>
      </div>

      {status ? (
        <div className="px-3 pb-3 pt-2">
          <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg w-full text-center truncate">
            {status}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-2 pb-2 pt-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat('breakfast')}
              className="text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-center disabled:opacity-50"
            >
              Breakfast
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat('lunch')}
              className="text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-center disabled:opacity-50"
            >
              Lunch
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat('dinner')}
              className="text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-center disabled:opacity-50"
            >
              Dinner
            </button>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleRepeat(null)}
            className="w-full text-[11px] font-semibold text-white dark:text-slate-950 py-1.5 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-xs text-center disabled:opacity-50"
          >
            All Day
          </button>
        </div>
      )}
    </div>
  );
}