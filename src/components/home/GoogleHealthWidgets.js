'use client';

import Link from 'next/link';
import { Footprints, Navigation, Flame, Target, MapPin, ChevronRight, RefreshCw } from 'lucide-react';

// Four dashboard metric cards (Steps, Distance, Burn, Remaining Goal).
// Dark mode: deep-navy glass cards with a coloured icon disc, big number and a
// gradient progress bar. Light mode: white cards with the same accents.
// The chevron (top-right) links to the Activity page.

const THEMES = {
  sky: {
    disc: 'bg-sky-100 border-sky-200 text-sky-600 dark:bg-cyan-500/10 dark:border-cyan-400/30 dark:text-cyan-300',
    bar: 'bg-gradient-to-r from-sky-500 to-cyan-400',
    accent: 'text-sky-600 dark:text-cyan-300',
    glow: 'dark:hover:shadow-cyan-500/10',
  },
  emerald: {
    disc: 'bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-300',
    accent: 'text-emerald-600 dark:text-emerald-300',
    glow: 'dark:hover:shadow-emerald-500/10',
  },
  violet: {
    disc: 'bg-violet-100 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-400/30 dark:text-violet-300',
    bar: 'bg-gradient-to-r from-violet-500 to-indigo-400',
    accent: 'text-violet-600 dark:text-violet-300',
    glow: 'dark:hover:shadow-violet-500/10',
  },
  pink: {
    disc: 'bg-pink-100 border-pink-200 text-pink-600 dark:bg-pink-500/10 dark:border-pink-400/30 dark:text-pink-300',
    bar: 'bg-gradient-to-r from-pink-500 to-rose-400',
    accent: 'text-pink-600 dark:text-pink-300',
    glow: 'dark:hover:shadow-pink-500/10',
  },
};

function MetricCard({
  theme,
  Icon,
  FooterIcon,
  title,
  value,
  sub,
  pct = 0,
  showBar = true,
  footerLabel,
  footerValue,
  loading = false,
  href = '/activity',
  footerExtra = null,
}) {
  const t = THEMES[theme];
  return (
    <div
      className={`group relative flex h-full min-h-[210px] flex-col rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-lg dark:border-[#14305a] dark:bg-gradient-to-b dark:from-slate-900 dark:to-[#050e22] ${t.glow}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${t.disc}`}>
          <Icon size={22} />
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
          <Link
            href={href}
            aria-label={`Open ${title} in Activity`}
            title="Open Activity"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="font-numeric mt-0.5 text-2xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="font-numeric mt-1.5 min-h-[1.25rem] text-sm text-slate-500 dark:text-sky-200/60">{sub}</p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        {showBar && (
          <div
            className={`h-full rounded-full transition-all duration-700 ${t.bar}`}
            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
          />
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
          <FooterIcon size={16} className={`shrink-0 ${t.accent}`} />
          <span className="truncate">{footerLabel}</span>
        </span>
        {footerExtra ?? <span className={`font-numeric shrink-0 text-sm font-bold ${t.accent}`}>{footerValue}</span>}
      </div>
    </div>
  );
}

function SetGoalLink() {
  return (
    <Link href="/settings" className="shrink-0 text-xs font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">
      Set a daily goal
    </Link>
  );
}

const pctOf = (v, goal) => (Number(goal) > 0 ? Math.min(Math.round((Number(v) / Number(goal)) * 100), 100) : 0);

export function StepsWidget({ steps = 0, targetSteps = null, loading = false }) {
  const hasGoal = Number(targetSteps) > 0;
  return (
    <MetricCard
      theme="sky"
      Icon={Footprints}
      FooterIcon={Target}
      title="Steps"
      value={Number(steps).toLocaleString('en-IN')}
      sub={hasGoal ? `/ ${Number(targetSteps).toLocaleString('en-IN')}` : 'steps today'}
      pct={pctOf(steps, targetSteps)}
      showBar={hasGoal}
      footerLabel="Daily Target"
      footerValue={hasGoal ? Number(targetSteps).toLocaleString('en-IN') : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      loading={loading}
    />
  );
}

export function DistanceWidget({ distanceKm = 0, targetKm = null, loading = false }) {
  const hasGoal = Number(targetKm) > 0;
  return (
    <MetricCard
      theme="emerald"
      Icon={Navigation}
      FooterIcon={MapPin}
      title="Distance"
      value={(Number(distanceKm) || 0).toFixed(1)}
      sub={hasGoal ? `/ ${Number(targetKm).toFixed(1)} km` : 'km today'}
      pct={pctOf(distanceKm, targetKm)}
      showBar={hasGoal}
      footerLabel="Daily Target"
      footerValue={hasGoal ? `${Number(targetKm).toFixed(1)} km` : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      loading={loading}
    />
  );
}

export function CaloriesBurnedWidget({ caloriesBurned = 0, targetBurn = null, loading = false }) {
  const burn = Math.max(0, Math.round(Number(caloriesBurned) || 0));
  const hasGoal = Number(targetBurn) > 0;
  return (
    <MetricCard
      theme="violet"
      Icon={Flame}
      FooterIcon={Flame}
      title="Burn"
      value={burn.toLocaleString('en-IN')}
      sub={hasGoal ? `/ ${Number(targetBurn).toLocaleString('en-IN')} kcal` : 'kcal today'}
      pct={pctOf(burn, targetBurn)}
      showBar={hasGoal}
      footerLabel="Daily Target"
      footerValue={hasGoal ? `${Number(targetBurn).toLocaleString('en-IN')} kcal` : null}
      footerExtra={hasGoal ? null : <SetGoalLink />}
      loading={loading}
    />
  );
}

export function RemainingGoalWidget({ consumedCalories = 0, targetCalories = 0 }) {
  const target = Math.max(0, Math.round(Number(targetCalories) || 0));
  const eaten = Math.max(0, Math.round(Number(consumedCalories) || 0));
  const left = Math.max(0, target - eaten);
  return (
    <MetricCard
      theme="pink"
      Icon={Target}
      FooterIcon={Target}
      title="Remaining Goal"
      value={left.toLocaleString('en-IN')}
      sub="kcal"
      pct={target > 0 ? Math.min(Math.round((eaten / target) * 100), 100) : 0}
      showBar
      footerLabel={left === 0 ? 'Goal reached' : 'To reach your goal'}
      footerValue={`${left.toLocaleString('en-IN')} kcal`}
    />
  );
}