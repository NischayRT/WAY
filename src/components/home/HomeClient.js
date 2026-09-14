'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UtensilsCrossed, ChefHat, Scale, CheckCircle2 } from 'lucide-react';
import { ui } from '@/lib/ui';
import { resolveDateTargets } from '@/lib/weightTimeline';
import WeekDateStrip from '@/components/home/WeekDateStrip';
import DateSelector from '@/components/home/DateSelector';
import ThemeToggle from '@/components/layout/ThemeToggle';
import MacroRings from '@/components/home/MacroRings';
import RepeatMealBanner from '@/components/home/RepeatMealBanner';
import DailyLog from '@/components/home/DailyLog';
import QuickWeightLogModal from '@/components/home/QuickWeightLogModal';

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
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(initialSelectedDate);
  }, [initialSelectedDate]);

  // Dynamically recalculate targets and effective weight based on the nearest weight to selectedDate
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

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[90px_1fr]">
        <WeekDateStrip
          days={days}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          today={today}
          minDate={minDate}
        />

        <div className={`space-y-6 transition-opacity ${isNavigating ? 'opacity-60' : ''}`}>
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-dotted dark:border-slate-700">
            <div>
              <h1 className={ui.heading}>{titleText}</h1>
              <p className="mt-0.5 text-xs text-slate-500 font-medium font-numeric">{fullDateStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DateSelector
                selectedDate={selectedDate}
                today={today}
                minDate={minDate}
                onSelectDate={handleSelectDate}
              />
            </div>
          </div>

          {/* Quick Weight Banner for the selected date */}
<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3 sm:p-4 shadow-xs">
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
        Target basis:{' '}
        <strong className="font-numeric text-slate-800 dark:text-slate-200">
          {currentTargets.effectiveWeight} kg
        </strong>
        {!isDateWeighedIn && (
          <span className="text-[10px] ml-1 opacity-75">(nearest)</span>
        )}
      </p>
    </div>
  </div>

  <button
    type="button"
    onClick={() => setWeightModalOpen(true)}
    className={`${
      isDateWeighedIn ? ui.btnSecondary : ui.btnPrimary
    } w-full sm:w-auto shrink-0 justify-center whitespace-nowrap py-2 px-3.5 text-xs font-semibold`}
  >
    {isDateWeighedIn ? 'Update Weight' : 'Log Weight'}
  </button>
</div>

          {/* Macro Gauges calibrated to that date's nearest-weight targets */}
          <div className={ui.card}>
            <MacroRings consumed={breakdown.overallTotals} targets={currentTargets} />
          </div>

          <RepeatMealBanner selectedDate={selectedDate} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/60 dark:text-slate-400">
              Goal: <span className="font-medium text-ink dark:text-slate-200">{goal.replace('_', ' ')}</span>
              {' · '}
              <span className="font-numeric">{currentTargets.bmr}</span> BMR ·{' '}
              <span className="font-numeric">{currentTargets.tdee}</span> TDEE
            </p>
            <div className="flex items-center gap-1">
              <Link href="/add-food" className={ui.btnSecondary}>
                <ChefHat size={15} /> Build recipe
              </Link>
              <Link href="/log-food" className={ui.btnPrimary}>
                <UtensilsCrossed size={15} /> Log food
              </Link>
            </div>
          </div>

          <DailyLog categories={breakdown.categories} />
        </div>
      </div>

      <QuickWeightLogModal
        userId={userId}
        currentWeight={currentTargets.effectiveWeight}
        targetDate={selectedDate}
        today={today}
        isOpen={weightModalOpen}
        onClose={() => setWeightModalOpen(false)}
      />
    </>
  );
}