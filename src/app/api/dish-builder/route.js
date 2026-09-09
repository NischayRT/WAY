import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { ingredientIds } = await request.json();
  if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Every recipe line for every dish visible to this user (RLS on
  // `foods` handles the visibility filtering automatically).
  const { data: recipeLines } = await supabase.from('dish_ingredients').select(
    'food_id, ingredient_id, foods (id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name), ingredients (name)'
  );

  if (!recipeLines) {
    return NextResponse.json({ matches: [] });
  }

  const haveSet = new Set(ingredientIds.map(Number));
  const byFood = new Map();

  for (const line of recipeLines) {
    if (!line.foods) continue; // hidden by RLS or dish was deleted
    if (!byFood.has(line.food_id)) {
      byFood.set(line.food_id, { food: line.foods, total: 0, matched: 0, missing: [] });
    }
    const entry = byFood.get(line.food_id);
    entry.total += 1;
    if (haveSet.has(line.ingredient_id)) {
      entry.matched += 1;
    } else {
      entry.missing.push(line.ingredients?.name ?? 'Unknown ingredient');
    }
  }

  const matches = Array.from(byFood.values())
    .map((e) => ({
      food: e.food,
      matched: e.matched,
      total: e.total,
      coverage: e.total > 0 ? e.matched / e.total : 0,
      missing: e.missing,
    }))
    .filter((m) => m.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 10);

  return NextResponse.json({ matches });
}
