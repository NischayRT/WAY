import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeDailyTotalsByDate } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import TrendsClient from '@/components/trends/TrendsClient';

export const dynamic = 'force-dynamic';

// Widest window the client can slice. One query covers 7/14/30 day views, so
// switching range costs no round trip.
const WINDOW_DAYS = 30;

export default async function TrendsPage() {
  const supabase = await createServerSupabaseClient();
  const today = todayLocalDate();
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: logs }] = await Promise.all([
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
      .gte('logged_at', windowStart)
      .lte('logged_at', today),
  ]);

  if (!profile) redirect('/onboarding');

  const targets = resolveDailyTargets(profile);
  const dailyTotalsByDate = computeDailyTotalsByDate(logs ?? []);

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(windowStart, i);
    const totals = dailyTotalsByDate.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const d = new Date(`${date}T00:00:00`);

    return {
      date,
      dayLabel: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
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
