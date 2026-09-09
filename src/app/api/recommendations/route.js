import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { recommendFoods } from '@/lib/recommend';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
    )
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const targets = resolveDailyTargets(profile);

  const today = new Date().toISOString().split('T')[0];
  const { data: todaysLogs } = await supabase
    .from('food_logs')
    .select('food_id, quantity_g, meal_type, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
    .eq('user_id', user.id)
    .eq('logged_at', today);

  const { overallTotals } = computeMealBreakdown(todaysLogs ?? []);

  const remaining = {
    calories: targets.targetCalories - overallTotals.calories,
    protein: targets.proteinG - overallTotals.protein,
    carbs: targets.carbsG - overallTotals.carbs,
    fat: targets.fatG - overallTotals.fat,
  };

  const { data: foods } = await supabase
    .from('foods')
    .select('id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name');

  // Personalization: how often has this user logged each food, all-time.
  const { data: historyRows } = await supabase
    .from('food_logs')
    .select('food_id')
    .eq('user_id', user.id);

  const historyCounts = new Map();
  (historyRows ?? []).forEach((row) => {
    historyCounts.set(row.food_id, (historyCounts.get(row.food_id) ?? 0) + 1);
  });

  const loggedTodayIds = new Set((todaysLogs ?? []).map((l) => l.food_id));

  const recommendations = recommendFoods({
    remaining,
    foods: foods ?? [],
    goal: profile.goal,
    historyCounts,
    loggedTodayIds,
    topN: 8,
  });

  return NextResponse.json({ remaining, recommendations });
}
