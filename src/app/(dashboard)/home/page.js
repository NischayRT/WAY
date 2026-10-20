import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { computeDailyTotalsByDate } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { resolveDateTargets } from '@/lib/weightTimeline';
import { loadLoginStreak, recordVisit } from '@/lib/streak';
import TodayClient from '@/components/today/TodayClient';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const LOG_SELECT = 'id, quantity_g, meal_type, logged_at, foods (name, calories_kcal, protein_g, carbs_g, fat_g)';

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const today = todayLocalDate();
  const supabase = await createServerSupabaseClient();

  const user = await getAuthUser(supabase);
  if (!user) redirect('/login');

  const weekStart = addDays(today, -6);
  const [{ data: profile }, { data: weightLogsData }, { data: ghConnection }, { data: weekLogs }, streak] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g, dream_target_weight_kg, dream_target_date, step_goal, distance_goal_km, burn_goal_kcal, waist_cm, hip_cm, chest_cm, bicep_cm'
      )
      .eq('id', user.id)
      .single(),
    supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: false }),
    supabase.from('google_health_connections').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('food_logs').select(LOG_SELECT).eq('user_id', user.id).gte('logged_at', weekStart).lte('logged_at', today),
    recordVisit(supabase, user.id, today).then(() => loadLoginStreak(supabase, user.id, today)),
  ]);

  if (!profile) redirect('/onboarding');

  const weightLogs = weightLogsData ?? [];
  const minDate = addDays(today, -365 * 2);

  let requestedDate = params?.date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate > today) requestedDate = today;
  if (requestedDate < minDate) requestedDate = minDate;

  const totalsByDate = computeDailyTotalsByDate(weekLogs ?? []);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const d = new Date(`${date}T00:00:00`);
    const totals = totalsByDate.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const dayTargets = resolveDateTargets({ profile, targetDateStr: date, weightLogs });
    const short = d.toLocaleDateString('en-IN', { weekday: 'short' });
    return {
      date,
      isToday: date === today,
      hasLogs: totalsByDate.has(date),
      short,
      letter: short.charAt(0),
      num: d.getDate(),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      target: dayTargets.targetCalories,
    };
  });

  const weekBreakdowns = {};
  for (const day of days) {
    weekBreakdowns[day.date] = computeMealBreakdown((weekLogs ?? []).filter((l) => l.logged_at === day.date));
  }

  let outOfRange = null;
  if (requestedDate < weekStart) {
    const { data: dayLogs } = await supabase.from('food_logs').select(LOG_SELECT).eq('user_id', user.id).eq('logged_at', requestedDate);
    outOfRange = { date: requestedDate, breakdown: computeMealBreakdown(dayLogs ?? []) };
  }

  return (
    <TodayClient
      profile={profile}
      weightLogs={weightLogs}
      days={days}
      today={today}
      minDate={minDate}
      weekBreakdowns={weekBreakdowns}
      initialSelectedDate={requestedDate}
      outOfRange={outOfRange}
      googleHealth={{ connected: !!ghConnection }}
      streak={streak}
    />
  );
}
