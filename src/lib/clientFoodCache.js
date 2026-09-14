let memoryFoods = null;
let memoryIngredients = null;

export async function fetchFoodsWithCache(supabase) {
  if (memoryFoods) return memoryFoods;
  const { data } = await supabase
    .from('foods')
    .select('id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name')
    .order('name');
  memoryFoods = data ?? [];
  return memoryFoods;
}

export function invalidateFoodCache() {
  memoryFoods = null;
}