'item client';

import { Activity, ArrowRight } from 'lucide-react';

export default function GoogleHealthConnectBanner({ returnTo = '/home' }) {
  const handleConnect = () => {
    window.location.href = `/api/google-health/connect?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 h-full min-h-[110px]">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Activity size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
            Activity Metrics
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Track steps &amp; distance with Google Health
          </p>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={handleConnect}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-black hover:bg-white-700 dark:bg-white dark:hover:bg-black text-white dark:text-black dark:hover:text-white py-1.5 px-3 text-xs font-semibold shadow-xs transition"
        >
          Connect Google Health <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}