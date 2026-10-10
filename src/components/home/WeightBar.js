'use client';

import Link from 'next/link';
import { Scale, CheckCircle2, Target, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import { prefetchWeightBody } from '@/components/home/WeightBodyPreview';
import FluidFill from './FluidFill';
import fx from './HealthTiles.module.css';

/**
 * Weight-for-the-day bar. It sizes itself with a CONTAINER query (its own
 * width, not the screen's), because it lives in different places:
 *  - wedged between the date strip and the profile menu on wide screens,
 *  - full width under them on tablets,
 *  - stacked on phones.
 *
 * Own width:
 *  < 340px   two rows: status, then a 2-column grid of actions
 *  >= 340px  one pill-shaped row; the target folds into the weight line
 *            ("79 kg -> 72 kg"), Change target / Sync are icon buttons
 *  340-439px the log button says just "Log" / "Update"
 *  >= 600px  target gets its own chip again, "Change target" text shown
 *  >= 720px  target date and "Sync" text shown
 */
export default function WeightBar({
  dateLabel,
  isLogged,
  weightKg,
  targetWeight,
  targetDate,
  previewOpen,
  onTogglePreview,
  onLogWeight,
  showSync,
  syncing,
  syncMsg,
  onSync,
  progress = null, // 0..1 of the way from the first logged weight to the target (lib/goalState weightProgress)
}) {
  const p = progress == null ? null : Math.max(0, Math.min(1, progress));
  const reached = p !== null && p >= 1;
  const btn =
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl @min-[340px]:rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60';
  const btnGhost = `${btn} border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`;
  const btnSolid = `${btn} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100`;

  return (
    <div className="@container relative h-full min-w-0">
      <div
        style={{ '--accent': '16 185 129' }}
        title={p !== null ? `${Math.round(p * 100)}% of the way to your target weight` : undefined}
        className={`relative isolate flex h-full flex-col gap-2.5 rounded-2xl border ${reached ? fx.reached : ''} border-slate-200/90 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/80 @min-[340px]:flex-row @min-[340px]:items-center @min-[340px]:justify-between @min-[340px]:gap-2 @min-[340px]:rounded-full @min-[340px]:py-1.5 @min-[340px]:pl-1.5 @min-[340px]:pr-1.5`}>
        {/* Progress toward the target weight, as a liquid filling the bar */}
        {p !== null && <FluidFill pct={p * 100} rgb="16 185 129" direction="right" strength={reached ? 1.3 : 1} />}
        {/* Status */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 @min-[340px]:rounded-full">
            <Scale size={17} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="truncate">Weight · {dateLabel}</span>
              {isLogged && <CheckCircle2 size={12} className="shrink-0 text-emerald-500" aria-label="Logged" />}
              {p !== null && (
                <span className={`shrink-0 font-numeric normal-case tracking-normal ${reached ? 'text-emerald-500' : 'text-slate-400'}`}>
                  · {reached ? 'goal reached 🎉' : `${Math.round(p * 100)}% to goal`}
                </span>
              )}
            </p>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              <span className="font-numeric">{weightKg} kg</span>
              {targetWeight ? (
                <span className="hidden font-numeric text-emerald-600 dark:text-emerald-400 @min-[340px]:@max-[600px]:inline">
                  {' '}
                  → {targetWeight} kg
                </span>
              ) : null}
              <span className="ml-1 text-[10px] font-medium text-slate-400 @max-[520px]:hidden">
                {isLogged ? 'logged' : 'nearest entry'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onTogglePreview}
            onMouseEnter={prefetchWeightBody}
            onFocus={prefetchWeightBody}
            onTouchStart={prefetchWeightBody}
            aria-expanded={previewOpen}
            aria-label={previewOpen ? 'Hide body preview' : 'Show body preview'}
            title={previewOpen ? 'Hide body preview' : 'Show body preview'}
            className="ml-auto shrink-0 rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white @min-[340px]:ml-1"
          >
            <ChevronDown size={15} className={`transition-transform duration-300 ${previewOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Target + actions */}
        <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800 @min-[340px]:flex @min-[340px]:shrink-0 @min-[340px]:items-center @min-[340px]:border-t-0 @min-[340px]:pt-0">
          {targetWeight ? (
            <div
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border @min-[340px]:@max-[600px]:hidden border-slate-200/80 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/80 @min-[340px]:rounded-full"
              title={targetDate ? `Target ${targetWeight} kg by ${targetDate}` : `Target ${targetWeight} kg`}
            >
              <Target size={14} className="shrink-0 text-emerald-500" />
              <span className="truncate">
                <span className="text-slate-500 dark:text-slate-400">Target </span>
                <strong className="font-numeric text-slate-900 dark:text-white">{targetWeight} kg</strong>
              </span>
              {targetDate && (
                <span className="hidden items-center gap-1 font-numeric text-[11px] text-slate-400 @min-[720px]:inline-flex">
                  <Calendar size={11} /> {targetDate}
                </span>
              )}
            </div>
          ) : null}

          <Link
            href="/settings?tab=body"
            aria-label={targetWeight ? 'Change target' : 'Add target'}
            title={targetWeight ? 'Change target' : 'Add target'}
            className={`${btnGhost} ${!targetWeight ? 'col-span-2 text-emerald-600 dark:text-emerald-400' : ''}`}
          >
            <Target size={14} className="shrink-0" />
            <span className="@min-[340px]:@max-[600px]:hidden">{targetWeight ? 'Change target' : 'Add target'}</span>
          </Link>

          <button type="button" onClick={onLogWeight} className={`${isLogged ? btnGhost : btnSolid} ${showSync ? '' : 'col-span-2'}`}>
            <span className="@min-[340px]:@max-[440px]:hidden">{isLogged ? 'Update weight' : 'Log weight'}</span>
            <span className="hidden @min-[340px]:@max-[440px]:inline">{isLogged ? 'Update' : 'Log'}</span>
          </button>

          {showSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              title="Send this day's weight to Google Health"
              aria-label="Sync weight to Google Health"
              className={`${btnGhost} disabled:opacity-60`}
            >
              <RefreshCw size={13} className={`shrink-0 ${syncing ? 'animate-spin' : ''}`} />
              <span className="@min-[340px]:@max-[720px]:hidden">{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync result: floats under the bar so it never pushes the header row around */}
      {syncMsg && (
        <p
          role="status"
          className={`absolute right-2 top-full z-20 mt-1.5 rounded-lg border bg-white px-2.5 py-1 text-[11px] font-medium shadow-md dark:bg-slate-900 ${
            syncMsg.ok
              ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
              : 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400'
          }`}
        >
          {syncMsg.text}
        </p>
      )}
    </div>
  );
}
