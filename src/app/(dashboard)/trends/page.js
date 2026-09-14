import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeDailyTotalsByDate } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import TrendsClient from '@/components/trends/TrendsClient';

export const dynamic = 'force-dynamic';

export default async function TrendsPage() {
  const supabase = await createServerSupabaseClient();
  const today = todayLocalDate();
  const weekStart = addDays(today, -6);

  // Authenticate user first
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Concurrently fetch profile targets and the 7-day food logs in a single round-trip
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
      .select('quantity_g, logged_at, foods (calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('user_id', user.id)
      .gte('logged_at', weekStart)
      .lte('logged_at', today),
  ]);

  if (!profile) redirect('/onboarding');

  const targets = resolveDailyTargets(profile);
  const dailyTotalsByDate = computeDailyTotalsByDate(weekLogs ?? []);

  // Compute 7-day aggregates directly on the server
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const totals = dailyTotalsByDate.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    };
  });

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader title="Trends" backHref="/home" backLabel="Back to today" />
      <TrendsClient days={days} targets={targets} />
    </main>
  );
}