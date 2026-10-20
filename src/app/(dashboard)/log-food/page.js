import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate, addDays, clampDate } from '@/lib/dateUtils';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';
import { resolveDateTargets } from '@/lib/weightTimeline';
import LogFoodClient from '@/components/logging/LogFoodClient';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export default async function LogFoodPage({ searchParams }) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect('/login');

  // Today can be parked on an earlier day; ?date= carries it over so meals
  // land on the day the user was looking at. ?meal= pre-selects the meal.
  const params = await searchParams;
  const today = todayLocalDate();
  const minDate = addDays(today, -90);
  const initialDate = clampDate(params?.date, minDate, today);
  const initialMeal = MEAL_CATEGORIES.some((m) => m.value === params?.meal) ? params.meal : undefined;
  const initialQuery = typeof params?.q === 'string' ? params.q.slice(0, 60) : '';

  const [{ data: profile }, { data: weightLogs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g')
      .eq('id', user.id)
      .single(),
    supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(60),
  ]);
  if (!profile) redirect('/onboarding');

  const targets = resolveDateTargets({ profile, targetDateStr: initialDate, weightLogs: weightLogs ?? [] });

  return (
    <LogFoodClient
      userId={user.id}
      today={today}
      minDate={minDate}
      initialDate={initialDate}
      initialMeal={initialMeal}
      initialQuery={initialQuery}
      targets={targets}
    />
  );
}
