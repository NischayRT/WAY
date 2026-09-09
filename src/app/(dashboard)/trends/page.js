import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeDailyTotalsByDate } from '@/lib/weekStatus';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import MacroBarChart from '@/components/trends/MacroBarChart';

export default async function TrendsPage() {
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

  const today = todayLocalDate();
  const weekStart = addDays(today, -6);

  const { data: weekLogs } = await supabase
    .from('food_logs')
    .select('quantity_g, logged_at, foods (calories_kcal, protein_g, carbs_g, fat_g)')
    .eq('user_id', user.id)
    .gte('logged_at', weekStart)
    .lte('logged_at', today);

  const dailyTotalsByDate = computeDailyTotalsByDate(weekLogs ?? []);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const totals = dailyTotalsByDate.get(date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      dayLabel: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
      ...totals,
    };
  });

  const seriesFor = (key) => days.map((d) => ({ dayLabel: d.dayLabel, value: Math.round(d[key]) }));
  const average = (series) => Math.round(series.reduce((s, d) => s + d.value, 0) / series.length);

  const caloriesData = seriesFor('calories');
  const proteinData = seriesFor('protein');
  const carbsData = seriesFor('carbs');
  const fatData = seriesFor('fat');

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader title="Trends" backHref="/home" backLabel="Back to today" />

      <p className="text-sm text-ink/60 dark:text-slate-400">
        Last 7 days · Avg{' '}
        <span className={`font-numeric ${ui.macroText.calories}`}>{average(caloriesData)} kcal</span> · Avg{' '}
        <span className={`font-numeric ${ui.macroText.protein}`}>{average(proteinData)}g protein</span>
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className={ui.card}>
          <MacroBarChart
            title="Calories"
            unit=" kcal"
            data={caloriesData}
            target={targets.targetCalories}
            colorClass="fill-turmeric"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Protein"
            unit="g"
            data={proteinData}
            target={targets.proteinG}
            colorClass="fill-cardamom"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Carbs"
            unit="g"
            data={carbsData}
            target={targets.carbsG}
            colorClass="fill-brick"
          />
        </div>
        <div className={ui.card}>
          <MacroBarChart
            title="Fat"
            unit="g"
            data={fatData}
            target={targets.fatG}
            colorClass="fill-brinjal"
          />
        </div>
      </div>
    </main>
  );
}
