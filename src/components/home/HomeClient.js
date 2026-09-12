'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UtensilsCrossed, ChefHat } from 'lucide-react';
import { ui } from '@/lib/ui';
import WeekDateStrip from '@/components/home/WeekDateStrip';
import DateSelector from '@/components/home/DateSelector';
import ThemeToggle from '@/components/layout/ThemeToggle';
import MacroRings from '@/components/home/MacroRings';
import RepeatMealBanner from '@/components/home/RepeatMealBanner';
import DailyLog from '@/components/home/DailyLog';

export default function HomeClient({
  days,
  today,
  weekStart,
  weekBreakdowns,
  initialSelectedDate,
  targets,
  goal,
  outOfRange,
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  // The one real navigation path: a date outside the cached 7-day window
  // that we don't have data for yet (reached via the calendar picker for
  // an older date). Every other case below is instant, no network call.
  const handleSelectDate = (date) => {
    const inCachedWeek = Object.prototype.hasOwnProperty.call(weekBreakdowns, date);
    const matchesOutOfRange = outOfRange?.date === date;

    if (inCachedWeek || matchesOutOfRange) {
      setSelectedDate(date);
      // Keep the URL shareable/bookmarkable and back-button-friendly
      // without triggering a Next.js navigation or server re-fetch.
      const url = date === today ? '/home' : `/home?date=${date}`;
      window.history.replaceState(null, '', url);
      return;
    }

    // Genuinely new date we have nothing cached for — this is the rare
    // path, so a real server round-trip here is fine.
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

  const { weekdayFull, fullDateStr } = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    return {
      weekdayFull: d.toLocaleDateString('en-IN', { weekday: 'long' }),
      fullDateStr: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }, [selectedDate]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[90px_1fr]">
      <WeekDateStrip
        days={days}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        weekStart={weekStart}
        today={today}
      />

      <div className={`space-y-6 transition-opacity ${isNavigating ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between pb-3 border-b-2 border-dotted dark:border-slate-700">
          <div>
            <h1 className={ui.heading}>{selectedDate === today ? 'Today' : weekdayFull}</h1>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">{fullDateStr}</p>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DateSelector selectedDate={selectedDate} today={today} onSelectDate={handleSelectDate} />
          </div>
        </div>

        <div className={ui.card}>
          <MacroRings consumed={breakdown.overallTotals} targets={targets} />
        </div>

        <RepeatMealBanner selectedDate={selectedDate} />

        <div className="flex items-center justify-between">
          <p className="text-sm text-ink/60 dark:text-slate-400">
            Goal: <span className="font-medium text-ink dark:text-slate-200">{goal.replace('_', ' ')}</span>
            {' · '}
            <span className="font-numeric">{targets.bmr}</span> BMR ·{' '}
            <span className="font-numeric">{targets.tdee}</span> TDEE
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
  );
}