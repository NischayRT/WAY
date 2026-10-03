// src/components/home/ActivityConnectBanner.js

'use client';

import { Activity, ArrowRight } from 'lucide-react';

export default function ActivityConnectBanner({ returnTo = '/home' }) {
  const handleGoogleConnect = () => {
    window.location.href = `/api/google-health/connect?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const handleStravaConnect = () => {
    window.location.href = `/api/strava/connect?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 h-full min-h-[110px]">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <Activity size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
            Activity Metrics
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Connect Google Health or Strava
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleGoogleConnect}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 text-[11px] font-semibold transition text-center truncate"
        >
          Google Health
        </button>
        <button
          type="button"
          onClick={handleStravaConnect}
          className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white py-1.5 px-2 text-[11px] font-semibold transition text-center truncate"
        >
          Strava
        </button>
      </div>
    </div>
  );
}