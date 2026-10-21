import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';
import { computeMealBreakdown } from '@/lib/mealBreakdown';
import { recommendFoods } from '@/lib/recommend';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { getAuthUser } from '@/lib/authServer';

const FOOD_COLS = 'id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name';

// The shared food list (created_by is null) is the same for everyone and
// rarely changes, so each server instance keeps it for 10 minutes instead of
// downloading the whole table on every request.
let shared = { at: 0, rows: null, pending: null };
const SHARED_TTL = 10 * 60 * 1000;
async function sharedFoodsCached(supabase) {
  if (shared.rows && Date.now() - shared.at < SHARED_TTL) return shared.rows;
  if (!shared.pending) {
    shared.pending = supabase
      .from('foods')
      .select(FOOD_COLS)
      .is('created_by', null)
      .then(({ data, error }) => {
        if (!error && data) shared = { at: Date.now(), rows: data, pending: null };
        else shared.pending = null;
        return data ?? shared.rows ?? [];
      });
  }
  return shared.pending;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Everything below is independent, so it is fetched in parallel (it used to
  // be four round trips to the database one after another).
  const today = todayLocalDate();
  const [{ data: profile, error: profileError }, { data: todaysLogs }, sharedFoods, { data: userFoods }, { data: historyRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g')
      .eq('id', user.id)
      .single(),
    // Was a UTC date, which pointed at yesterday for any request before
    // 05:30 IST — recommendations were computed against the wrong day's logs.
    supabase
      .from('food_logs')
      .select('food_id, quantity_g, meal_type, foods (name, calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('user_id', user.id)
      .eq('logged_at', today),
    sharedFoodsCached(supabase),
    // Foods people added themselves (yours, and any shared by others) — small.
    supabase.from('foods').select(FOOD_COLS).not('created_by', 'is', null),
    // Personalisation: how often you logged each food in the last 6 months.
    supabase.from('food_logs').select('food_id').eq('user_id', user.id).gte('logged_at', addDays(today, -180)),
  ]);

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const targets = resolveDailyTargets(profile);
  const { overallTotals } = computeMealBreakdown(todaysLogs ?? []);

  const remaining = {
    calories: targets.targetCalories - overallTotals.calories,
    protein: targets.proteinG - overallTotals.protein,
    carbs: targets.carbsG - overallTotals.carbs,
    fat: targets.fatG - overallTotals.fat,
  };

  const foods = [...sharedFoods, ...(userFoods ?? [])];

  const historyCounts = new Map();
  (historyRows ?? []).forEach((row) => {
    historyCounts.set(row.food_id, (historyCounts.get(row.food_id) ?? 0) + 1);
  });

  const loggedTodayIds = new Set((todaysLogs ?? []).map((l) => l.food_id));

  const recommendations = recommendFoods({
    remaining,
    foods,
    goal: profile.goal,
    historyCounts,
    loggedTodayIds,
    topN: 8,
  });

  return NextResponse.json({ remaining, recommendations });
}
