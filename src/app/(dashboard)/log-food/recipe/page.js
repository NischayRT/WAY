import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import RecipeBuilderClient from '@/components/logging/RecipeBuilderClient';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export default async function RecipePage({ searchParams }) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect('/login');

  const params = await searchParams;
  const initialName = typeof params?.name === 'string' ? params.name.slice(0, 80) : '';
  const editId = /^\d{1,18}$/.test(params?.edit ?? '') ? Number(params.edit) : null;

  const [{ data: profile }, { data: recipeLines }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    // Dishes that already have a recipe (RLS limits this to dishes the user can see).
    supabase
      .from('dish_ingredients')
      .select('food_id, ingredient_id, quantity_g, foods (id, name, final_weight_g, cooking_method, dish_class, created_by, archived_at)')
      .limit(2000),
  ]);

  // Editing one of your own dishes (the database enforces ownership again on save).
  let editing = null;
  if (editId) {
    const { data: food } = await supabase
      .from('foods')
      .select('id, name, cooking_method, dish_class, final_weight_g, serving_size_g, created_by, archived_at')
      .eq('id', editId)
      .maybeSingle();
    if (!food || food.created_by !== user.id || food.archived_at) redirect('/log-food');
    const { data: lines } = await supabase.from('dish_ingredients').select('ingredient_id, quantity_g').eq('food_id', editId);
    const { created_by: _c, archived_at: _a, ...rest } = food;
    editing = { ...rest, lines: lines ?? [] };
  }

  // Group recipe lines per dish; the user's own dishes first, then the rest.
  // All of them are searchable as "start from a similar dish".
  const byFood = new Map();
  for (const l of recipeLines ?? []) {
    if (!l.foods || l.foods.archived_at) continue;
    if (!byFood.has(l.food_id)) byFood.set(l.food_id, { ...l.foods, lines: [] });
    byFood.get(l.food_id).lines.push({ ingredient_id: l.ingredient_id, quantity_g: l.quantity_g });
  }
  const starters = [...byFood.values()]
    .filter((d) => d.lines.length >= 2)
    .sort((a, b) => (b.created_by === user.id) - (a.created_by === user.id) || a.name.localeCompare(b.name))
    .map(({ created_by: _ignored, archived_at: _gone, ...d }) => d);

  return <RecipeBuilderClient authorName={profile?.full_name ?? null} starters={starters} initialName={initialName} editing={editing} />;
}
