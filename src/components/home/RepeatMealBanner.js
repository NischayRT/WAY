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
    const res = await fetch('/api/repeat-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: selectedDate, mealType }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setStatus(`Copied ${data.count} item${data.count > 1 ? 's' : ''} from yesterday!`);
      router.refresh();
      setTimeout(() => setStatus(null), 3500);
    } else {
      setStatus(data.error || 'Failed to copy');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          <RotateCcw size={16} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
            Quick Repeat <Sparkles size={12} className="text-amber-500" />
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Copy what you ate yesterday into today&apos;s log
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
        {status ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            {status}
          </span>
        ) : (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat('breakfast')}
              className="flex-1 sm:flex-none text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Breakfast
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat('lunch')}
              className="flex-1 sm:flex-none text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Lunch
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRepeat(null)}
              className="flex-1 sm:flex-none text-xs font-semibold text-white dark:text-slate-950 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-xs"
            >
              All Day
            </button>
          </>
        )}
      </div>
    </div>
  );
}