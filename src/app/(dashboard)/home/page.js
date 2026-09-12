import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { computeDailyTotalsByDate, getDayVisualStatus } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { ui } from '@/lib/ui';
import HomeClient from '@/components/home/HomeClient';

// Same reasoning as settings/page.js and onboarding/page.js: this page is
// scoped to a specific authenticated user (profile + food logs), so it
// must never be served from a stale cached render across account changes.
export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const today = todayLocalDate();
  const requestedDate = params?.date || today;
  const weekStart = addDays(today, -6);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Independent queries — profile doesn't depend on weekLogs or vice versa,
  // so run them concurrently instead of one after another. This alone cuts
  // round-trip time for every load roughly in half.
  const [{ data: profile }, { data: weekLogs }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('food_logs')
      .select('id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('user_id', user.id)
      .gte('logged_at', weekStart)
      .lte('logged_at', today),
  ]);

  if (!profile) redirect('/onboarding');

  const targets = resolveDailyTargets(profile);

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

  // Pre-compute EVERY in-week day's meal breakdown up front, once, from the
  // single weekLogs fetch above. This is the actual fix for "switching days
  // is slow": the client never needs to ask the server again for any date
  // in this list — it already has everything, and can switch instantly.
  const weekBreakdowns = {};
  for (const day of days) {
    const logsForDay = (weekLogs ?? []).filter((l) => l.logged_at === day.date);
    weekBreakdowns[day.date] = computeMealBreakdown(logsForDay);
  }

  // The requested date might be older than the 7-day window (reached via
  // the calendar picker for a specific past date). That's the one case that
  // still needs its own fetch — the rare path, not the common one.
  const requestedInWeek = requestedDate >= weekStart && requestedDate <= today;
  let outOfRange = null;
  if (!requestedInWeek) {
    const { data: outOfRangeLogs } = await supabase
      .from('food_logs')
      .select('id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('user_id', user.id)
      .eq('logged_at', requestedDate);

    outOfRange = {
      date: requestedDate,
      breakdown: computeMealBreakdown(outOfRangeLogs ?? []),
    };
  }

  return (
    <main className={ui.pageWrapWide}>
      <HomeClient
        days={days}
        today={today}
        weekStart={weekStart}
        weekBreakdowns={weekBreakdowns}
        initialSelectedDate={requestedDate}
        targets={targets}
        goal={profile.goal}
        outOfRange={outOfRange}
      />
    </main>
  );
}