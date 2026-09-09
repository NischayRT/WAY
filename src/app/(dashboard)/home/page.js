import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { computeDailyTotalsByDate, getDayVisualStatus } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { UtensilsCrossed, ChefHat } from 'lucide-react';
import { ui } from '@/lib/ui';
import MacroRings from '@/components/home/MacroRings';
import WeekDateStrip from '@/components/home/WeekDateStrip';
import DateSelector from '@/components/home/DateSelector';
import DailyLog from '@/components/home/DailyLog';
import RepeatMealBanner from '@/components/home/RepeatMealBanner';
import ThemeToggle from '@/components/layout/ThemeToggle';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const today = todayLocalDate();
  const selectedDate = params?.date || today;
  const weekStart = addDays(today, -6);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
    )
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  const targets = resolveDailyTargets(profile);

  const { data: weekLogs } = await supabase
    .from('food_logs')
    .select('id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
    .eq('user_id', user.id)
    .gte('logged_at', weekStart)
    .lte('logged_at', today);

  const dailyTotalsByDate = computeDailyTotalsByDate(weekLogs ?? []);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const isToday = date === today;
    const consumed = dailyTotalsByDate.get(date) ?? { calories: 0, protein: 0 };
    const hasLogs = dailyTotalsByDate.has(date);
    const { bgClass, borderClass } = getDayVisualStatus({ hasLogs, consumed, targets });
    return {
      date,
      isToday,
      dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
      dateLabel: new Date(`${date}T00:00:00`).getDate(),
      bgClass,
      borderClass,
    };
  });

  const selectedInWeek = selectedDate >= weekStart && selectedDate <= today;
  const { data: outOfRangeLogs } = selectedInWeek
    ? { data: null }
    : await supabase
        .from('food_logs')
        .select('id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
        .eq('user_id', user.id)
        .eq('logged_at', selectedDate);

  const logsForSelectedDate = selectedInWeek
    ? (weekLogs ?? []).filter((l) => l.logged_at === selectedDate)
    : outOfRangeLogs ?? [];

  const { categories, overallTotals } = computeMealBreakdown(logsForSelectedDate);

  const weekdayFull = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
  });
  const fullDateStr = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <main className={ui.pageWrapWide}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[90px_1fr]">
        <WeekDateStrip days={days} selectedDate={selectedDate} />
        <div className="space-y-6">
          {/* Header Bar with Dedicated Theme Toggle */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-dotted dark:border-slate-700">
            <div>
              <h1 className={ui.heading}>{selectedDate === today ? 'Today' : weekdayFull}</h1>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">{fullDateStr}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <DateSelector selectedDate={selectedDate} />
            </div>
          </div>

          <div className={ui.card}>
            <MacroRings consumed={overallTotals} targets={targets} />
          </div>

          <RepeatMealBanner selectedDate={selectedDate} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/60 dark:text-slate-400">
              Goal:{' '}
              <span className="font-medium text-ink dark:text-slate-200">{profile.goal.replace('_', ' ')}</span>
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

          <DailyLog categories={categories} />
        </div>
      </div>
    </main>
  );
}