import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { computeDailyTotalsByDate, getDayVisualStatus } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { resolveDateTargets } from '@/lib/weightTimeline';
import { ui } from '@/lib/ui';
import HomeClient from '@/components/home/HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const today = todayLocalDate();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Single parallel pass fetching profile, week logs, and all user weight logs
  const [{ data: profile }, { data: weightLogsData }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false }),
  ]);

  if (!profile) redirect('/onboarding');

  const weightLogs = weightLogsData ?? [];
  const currentYear = new Date().getFullYear();
  const userAge = Number(profile.age) || 25;
  const birthYear = currentYear - userAge;
  const minDate = `${birthYear}-01-01`;

  let requestedDate = params?.date || today;
  if (requestedDate < minDate) {
    requestedDate = minDate;
  } else if (requestedDate > today) {
    requestedDate = today;
  }

  const weekStart = addDays(today, -6);

  const { data: weekLogs } = await supabase
    .from('food_logs')
    .select('id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
    .eq('user_id', user.id)
    .gte('logged_at', weekStart)
    .lte('logged_at', today);

  // Targets for initial view calculated using nearest weight
  const initialTargets = resolveDateTargets({
    profile,
    targetDateStr: requestedDate,
    weightLogs,
  });

  const dailyTotalsByDate = computeDailyTotalsByDate(weekLogs ?? []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const isToday = date === today;
    const isBeforeMinDate = date < minDate;
    const consumed = dailyTotalsByDate.get(date) ?? { calories: 0, protein: 0 };
    const hasLogs = dailyTotalsByDate.has(date);

    // Compute status against the nearest weight target of that day
    const dayTargets = resolveDateTargets({
      profile,
      targetDateStr: date,
      weightLogs,
    });

    const { bgClass, borderClass } = getDayVisualStatus({
      hasLogs,
      consumed,
      targets: dayTargets,
    });

    return {
      date,
      isToday,
      isBeforeMinDate,
      dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
      dateLabel: new Date(`${date}T00:00:00`).getDate(),
      bgClass,
      borderClass,
    };
  });

  const weekBreakdowns = {};
  for (const day of days) {
    const logsForDay = (weekLogs ?? []).filter((l) => l.logged_at === day.date);
    weekBreakdowns[day.date] = computeMealBreakdown(logsForDay);
  }

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

  const todayWeighedIn = weightLogs.some((w) => w.logged_at === today);

  return (
    <main className={ui.pageWrapWide}>
      <HomeClient
        userId={user.id}
        profile={profile}
        weightLogs={weightLogs}
        currentWeightKg={initialTargets.effectiveWeight}
        todayWeighedIn={todayWeighedIn}
        days={days}
        today={today}
        minDate={minDate}
        weekStart={weekStart}
        weekBreakdowns={weekBreakdowns}
        initialSelectedDate={requestedDate}
        initialTargets={initialTargets}
        goal={profile.goal}
        outOfRange={outOfRange}
      />
    </main>
  );
}