'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scale, CheckCircle2, Target, Calendar, RefreshCw, Activity, ChevronDown } from 'lucide-react';
import WeightBodyPreview, { prefetchWeightBody } from '@/components/home/WeightBodyPreview';
import { ui } from '@/lib/ui';
import { resolveDateTargets } from '@/lib/weightTimeline';
import WeekDateStrip from '@/components/home/WeekDateStrip';
import NutritionalOrbitPanel from '@/components/home/NutritionalOrbitPanel';
import MealTargetsCard from '@/components/home/MealTargetsCard';
import WeekMacroChart from '@/components/home/WeekMacroChart';
import RepeatMealBanner from '@/components/home/RepeatMealBanner';
import DailyLog from '@/components/home/DailyLog';
import QuickWeightLogModal from '@/components/home/QuickWeightLogModal';
import { StepsWidget, DistanceWidget, CaloriesBurnedWidget, RemainingGoalWidget } from '@/components/home/GoogleHealthWidgets';
import { syncToGoogleHealthAndWait, describeSyncResult } from '@/lib/googleHealthSyncClient';

export default function HomeClient({
  userId,
  profile,
  weightLogs,
  todayWeighedIn,
  days,
  today,
  minDate,
  weekStart,
  weekBreakdowns,
  initialSelectedDate,
  initialTargets,
  goal,
  outOfRange,
  googleHealth = { connected: false },
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [healthData, setHealthData] = useState({ steps: 0, distanceKm: 0, caloriesBurned: 0 });
  const [healthConnected, setHealthConnected] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [weightPreviewOpen, setWeightPreviewOpen] = useState(false);
  const [weightSyncing, setWeightSyncing] = useState(false);
  const [weightSyncMsg, setWeightSyncMsg] = useState(null);

  useEffect(() => {
    setSelectedDate(initialSelectedDate);
  }, [initialSelectedDate]);

  useEffect(() => {
    setWeightSyncMsg(null);
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    const ctrl = new AbortController();
    async function fetchHealthMetrics() {
      setHealthLoading(true);
      try {
        const res = await fetch(`/api/google-health/steps?date=${selectedDate}`, { signal: ctrl.signal });
        if (!res.ok) {
          if (isMounted) {
            setHealthData({ steps: 0, distanceKm: 0, caloriesBurned: 0 });
            setHealthConnected(false);
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          if (data.connected) {
            setHealthConnected(true);
            setHealthData({
              steps: Number(data.steps) || 0,
              distanceKm: Number(data.distanceKm) || 0,
              caloriesBurned: Number(data.caloriesBurned) || 0,
            });
          } else {
            setHealthConnected(false);
            setHealthData({ steps: 0, distanceKm: 0, caloriesBurned: 0 });
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('health fetch failed', selectedDate, err);
      } finally {
        if (isMounted) setHealthLoading(false);
      }
    }
    if (selectedDate) fetchHealthMetrics();
    return () => {
      isMounted = false;
      ctrl.abort();
    };
  }, [selectedDate]);

  // Dynamically recalculate targets based on nearest weight entry to selectedDate
  const currentTargets = useMemo(() => {
    return resolveDateTargets({
      profile,
      targetDateStr: selectedDate,
      weightLogs,
    });
  }, [profile, selectedDate, weightLogs]);

  const isDateWeighedIn = useMemo(() => {
    return weightLogs.some((w) => w.logged_at === selectedDate);
  }, [weightLogs, selectedDate]);

  const showSyncWeight = !!googleHealth?.connected && isDateWeighedIn;

  const handleSyncWeight = async () => {
    setWeightSyncing(true);
    setWeightSyncMsg(null);
    const res = await syncToGoogleHealthAndWait({ action: 'weight_upsert', date: selectedDate });
    setWeightSyncMsg(describeSyncResult('Weight', res));
    setWeightSyncing(false);
  };

  const handleSelectDate = (date) => {
    if (!date || date < minDate || date > today) return;

    setSelectedDate(date);
    const inCachedWeek = Object.prototype.hasOwnProperty.call(weekBreakdowns, date);
    const matchesOutOfRange = outOfRange?.date === date;

    if (inCachedWeek || matchesOutOfRange) {
      const url = date === today ? '/home' : `/home?date=${date}`;
      window.history.replaceState(null, '', url);
      return;
    }

    startTransition(() => {
      router.push(`/home?date=${date}`);
    });
  };

  const breakdown = useMemo(() => {
    if (Object.prototype.hasOwnProperty.call(weekBreakdowns, selectedDate)) {
      return weekBreakdowns[selectedDate];
    }
    if (outOfRange?.date === selectedDate) {
      return outOfRange.breakdown;
    }
    return { categories: [], overallTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 } };
  }, [weekBreakdowns, outOfRange, selectedDate]);

  const { titleText, fullDateStr } = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return {
      titleText: selectedDate === today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'long' }),
      fullDateStr: d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
  }, [selectedDate, today]);

  // Profile target attributes
  // Saved from Settings → Body Measurements → "Set goal".
  const targetWeight = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
  const targetFinalDate = profile?.dream_target_date
    ? new Date(`${String(profile.dream_target_date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <div className="space-y-4">
        {/* Week strip navigation */}
        <WeekDateStrip
          days={days}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          today={today}
          minDate={minDate}
          userName={profile?.full_name}
        />

        <div className={`space-y-6 transition-opacity ${isNavigating ? 'opacity-60' : ''}`}>
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-dotted dark:border-slate-700">
            <div>
              <h1 className={ui.heading}>{titleText}</h1>
              <p className="mt-0.5 text-xs text-slate-500 font-medium font-numeric">{fullDateStr}</p>
            </div>
          </div>
{/* Quick Weight & Target Banner for the selected date */}
<div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden">
<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4 p-3 sm:p-4">
  {/* Weight Status */}
  <div className="flex items-center gap-3 min-w-0">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
      <Scale size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
          Weight for {selectedDate === today ? 'Today' : fullDateStr}
        </p>
        {isDateWeighedIn && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 size={13} className="shrink-0" /> Logged
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Current basis:{' '}
        <strong className="font-numeric text-slate-800 dark:text-slate-200">
          {currentTargets.effectiveWeight} kg
        </strong>
        {!isDateWeighedIn && <span className="text-[10px] ml-1 opacity-75">(nearest)</span>}
      </p>
    </div>
    <button
      type="button"
      onClick={() => setWeightPreviewOpen((o) => !o)}
      onMouseEnter={prefetchWeightBody}
      onFocus={prefetchWeightBody}
      onTouchStart={prefetchWeightBody}
      aria-expanded={weightPreviewOpen}
      aria-label={weightPreviewOpen ? 'Hide body preview' : 'Show body preview'}
      title={weightPreviewOpen ? 'Hide body preview' : 'Show body preview'}
      className="ml-auto shrink-0 rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <ChevronDown size={16} className={`transition-transform duration-300 ${weightPreviewOpen ? 'rotate-180' : ''}`} />
    </button>
  </div>

  {/* Target Weight & Action Buttons
      Mobile: 2-col grid -> [Target | Change Target] / [Update Weight | Sync weight].
      md+: single wrapping row. */}
  <div className="grid grid-cols-2 gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 min-w-0 md:flex md:flex-wrap md:items-center md:gap-2.5">
    {targetWeight && (
      
      <div className="flex justify-center min-w-0 items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-1.5 md:px-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
        <Target size={14} className="text-emerald-500 shrink-0" />
        <div className="min-w-0 truncate text-xs font-medium">
          <span className="text-slate-500 dark:text-slate-400">Target: </span>
          <strong className="font-numeric text-slate-900 dark:text-white">{targetWeight} kg</strong>
          {targetFinalDate && (
            <span className="ml-2 hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 font-numeric">
              <Calendar size={11} /> {targetFinalDate}
            </span>
          )}
        </div>
      </div>
    )}

    <Link
      href="/settings?tab=body"
      className={`${ui.btnSecondary} ${!targetWeight ? 'col-span-2' : ''} md:flex-none justify-center items-center whitespace-nowrap !gap-1 !px-2 !py-1.5 md:!gap-1.5 md:!px-3 md:!py-2 text-xs font-semibold ${
        !targetWeight ? 'text-emerald-600 dark:text-emerald-400' : ''
      }`}
    >
      <Target size={14} className="shrink-0" />
      {targetWeight ? 'Change Target' : 'Add Target'}
    </Link>

    <button
      type="button"
      onClick={() => setWeightModalOpen(true)}
      className={`${isDateWeighedIn ? ui.btnSecondary : ui.btnPrimary} ${showSyncWeight ? '' : 'col-span-2'} md:flex-none justify-center whitespace-nowrap !px-2 !py-1.5 md:!px-3.5 md:!py-2 text-xs font-semibold`}
    >
      {isDateWeighedIn ? 'Update Weight' : 'Log Weight'}
    </button>

    {showSyncWeight && (
      <button
        type="button"
        onClick={handleSyncWeight}
        disabled={weightSyncing}
        title="Send this day's weight to Google Health"
        className={`${ui.btnSecondary} md:flex-none justify-center items-center whitespace-nowrap !gap-1 !px-2 !py-1.5 md:!gap-1.5 md:!px-3 md:!py-2 text-xs font-semibold disabled:opacity-60`}
      >
        <RefreshCw size={13} className={`shrink-0 ${weightSyncing ? 'animate-spin' : ''}`} />
        {weightSyncing ? 'Syncing...' : 'Sync weight'}
      </button>
    )}

    {weightSyncMsg && (
      <p
        className={`col-span-2 text-[11px] font-medium md:w-full md:text-right ${
          weightSyncMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}
      >
        {weightSyncMsg.text}
      </p>
    )}
  </div>
</div>

<WeightBodyPreview
  open={weightPreviewOpen}
  profile={profile}
  weightKg={currentTargets.effectiveWeight}
  weightLogs={weightLogs}
/>
</div>

          {/* Orbit + Meal Targets + Weekly Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            <div className="lg:col-span-5">
              <NutritionalOrbitPanel consumed={breakdown.overallTotals} targets={currentTargets} />
            </div>
            <div className="lg:col-span-3">
              <MealTargetsCard breakdown={breakdown} targets={currentTargets} />
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="flex-1 min-h-[260px]">
                <WeekMacroChart
                  days={days}
                  weekBreakdowns={weekBreakdowns}
                  targetCalories={currentTargets.targetCalories}
                />
              </div>
              <RepeatMealBanner selectedDate={selectedDate} />
            </div>
          </div>

          <HealthRow
            goals={{
              steps: profile?.step_goal ?? null,
              distanceKm: profile?.distance_goal_km ? Number(profile.distance_goal_km) : null,
              burnKcal: profile?.burn_goal_kcal ?? null,
            }}
            consumed={breakdown.overallTotals}
            currentTargets={currentTargets}
            healthData={healthData}
            healthConnected={healthConnected}
            healthLoading={healthLoading}
          />

          <DailyLog
            categories={breakdown.categories}
            selectedDate={selectedDate}
            today={today}
            googleHealthConnected={!!googleHealth?.connected}
          />
        </div>
      </div>

      <QuickWeightLogModal
        currentWeight={currentTargets.effectiveWeight}
        targetDate={selectedDate}
        today={today}
        isOpen={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
      />
    </>
  );
}

function HealthRow({ consumed, currentTargets, healthData, healthConnected, healthLoading, goals = {} }) {
  const remaining = (
    <RemainingGoalWidget consumedCalories={consumed?.calories ?? 0} targetCalories={currentTargets.targetCalories} />
  );

  if (healthConnected === false) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <div className="sm:col-span-1 xl:col-span-3 flex min-h-[210px] flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-[#14305a] dark:bg-gradient-to-b dark:from-[#071530] dark:to-[#050e22]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-200 bg-sky-100 text-sky-600 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300">
              <Activity size={22} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">Track your fitness</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Steps · Distance · Calories burned</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-snug text-slate-500 dark:text-sky-200/60">
            Connect Google Health to see steps, distance and active calories here.
          </p>
          <a
            href="/api/google-health/connect?returnTo=%2Fhome"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:w-auto sm:self-start"
          >
            Connect Google Health
          </a>
        </div>
        {remaining}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
      <StepsWidget steps={healthData.steps} targetSteps={goals.steps ?? null} loading={healthLoading} />
      <DistanceWidget distanceKm={healthData.distanceKm} targetKm={goals.distanceKm ?? null} loading={healthLoading} />
      <CaloriesBurnedWidget caloriesBurned={healthData.caloriesBurned} targetBurn={goals.burnKcal ?? null} loading={healthLoading} />
      {remaining}
    </div>
  );
}