'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import WeightBodyPreview from '@/components/home/WeightBodyPreview';
import WeightBar from '@/components/home/WeightBar';
import { weightProgress } from '@/lib/goalState';
import { ui } from '@/lib/ui';
import { resolveDateTargets } from '@/lib/weightTimeline';
import WeekDateStrip from '@/components/home/WeekDateStrip';
import NutritionalOrbitPanel from '@/components/home/NutritionalOrbitPanel';
import MealTargetsCard from '@/components/home/MealTargetsCard';
import WeekMacroChart from '@/components/home/WeekMacroChart';
import RepeatMealBanner from '@/components/home/RepeatMealBanner';
import DailyLog from '@/components/home/DailyLog';
import QuickWeightLogModal from '@/components/home/QuickWeightLogModal';
import { RemainingGoalWidget } from '@/components/home/GoogleHealthWidgets';
import TileBoard from '@/components/home/TileBoard';
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
  const [healthData, setHealthData] = useState({ steps: 0, distanceKm: 0, caloriesBurned: 0, activeCalories: 0 });
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
            setHealthData({ steps: 0, distanceKm: 0, caloriesBurned: 0, activeCalories: 0 });
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
              activeCalories: Number(data.activeCalories) || 0,
            });
          } else {
            setHealthConnected(false);
            setHealthData({ steps: 0, distanceKm: 0, caloriesBurned: 0, activeCalories: 0 });
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

  const shortDateLabel = useMemo(() => {
    if (selectedDate === today) return 'Today';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [selectedDate, today]);

  // Profile target attributes
  // Saved from Settings → Body Measurements → "Set goal".
  const targetWeight = profile?.dream_target_weight_kg ? Number(profile.dream_target_weight_kg) : null;
  const weightProgressShare = useMemo(
    () => weightProgress({ weightLogs, currentKg: currentTargets.effectiveWeight, targetKg: targetWeight }),
    [weightLogs, currentTargets.effectiveWeight, targetWeight]
  );
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
          middle={
            <div className={`h-full transition-opacity ${isNavigating ? 'opacity-60' : ''}`}>
              <WeightBar
                dateLabel={shortDateLabel}
                isLogged={isDateWeighedIn}
                weightKg={currentTargets.effectiveWeight}
                targetWeight={targetWeight}
                progress={weightProgressShare}
                targetDate={targetFinalDate}
                previewOpen={weightPreviewOpen}
                onTogglePreview={() => setWeightPreviewOpen((o) => !o)}
                onLogWeight={() => setWeightModalOpen(true)}
                showSync={showSyncWeight}
                syncing={weightSyncing}
                syncMsg={weightSyncMsg}
                onSync={handleSyncWeight}
              />
            </div>
          }
        />

        {/* Body preview for the weight bar: opens full width under the header */}
        <div
          className={`overflow-hidden rounded-2xl border transition-colors ${
            weightPreviewOpen ? 'border-slate-200/90 shadow-xs dark:border-slate-800' : 'border-transparent'
          }`}
        >
          <WeightBodyPreview
            open={weightPreviewOpen}
            profile={profile}
            weightKg={currentTargets.effectiveWeight}
            weightLogs={weightLogs}
          />
        </div>

        <div className={`space-y-6 transition-opacity ${isNavigating ? 'opacity-60' : ''}`}>
          {/* Header Bar */}
          {/* <div className="flex items-center justify-between pb-3 border-b-2 border-dotted dark:border-slate-700">
            <div>
              <h1 className={ui.heading}>{titleText}</h1>
              <p className="mt-0.5 text-xs text-slate-500 font-medium font-numeric">{fullDateStr}</p>
            </div>
          </div> */}

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
            today={today}
            selectedDate={selectedDate}
            userId={profile?.id}
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

function HealthRow({ consumed, currentTargets, healthData, healthConnected, healthLoading, today, selectedDate, userId, goals = {} }) {
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

  // Connected: the user's own choice of tiles (Edit tiles to change).
  return (
    <TileBoard
      userId={userId}
      selectedDate={selectedDate}
      today={today}
      healthData={healthData}
      healthLoading={healthLoading}
      goals={goals}
      consumed={consumed}
      currentTargets={currentTargets}
    />
  );
}
