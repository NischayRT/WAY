import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import RecipeBuilderClient from '@/components/logging/RecipeBuilderClient';

export const dynamic = 'force-dynamic';

const MAX_STARTERS = 8;

export default async function RecipePage({ searchParams }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const initialName = typeof params?.name === 'string' ? params.name.slice(0, 80) : '';

  const [{ data: profile }, { data: recipeLines }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    // Dishes that already have a recipe (RLS limits this to dishes the user can see).
    supabase
      .from('dish_ingredients')
      .select('food_id, ingredient_id, quantity_g, foods (id, name, final_weight_g, cooking_method, dish_class, created_by)')
      .limit(2000),
  ]);

  // Group recipe lines per dish; the user's own dishes first, then the rest.
  const byFood = new Map();
  for (const l of recipeLines ?? []) {
    if (!l.foods) continue;
    if (!byFood.has(l.food_id)) byFood.set(l.food_id, { ...l.foods, lines: [] });
    byFood.get(l.food_id).lines.push({ ingredient_id: l.ingredient_id, quantity_g: l.quantity_g });
  }
  const starters = [...byFood.values()]
    .filter((d) => d.lines.length >= 2)
    .sort((a, b) => (b.created_by === user.id) - (a.created_by === user.id) || a.name.localeCompare(b.name))
    .slice(0, MAX_STARTERS)
    .map(({ created_by: _ignored, ...d }) => d);

  return <RecipeBuilderClient authorName={profile?.full_name ?? null} starters={starters} initialName={initialName} />;
}
