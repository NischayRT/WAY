// lib/cache/foodCache.js
let cachedFoods = null;
let cachedIngredients = null;

export async function getCachedFoods(supabase) {
  if (cachedFoods) return cachedFoods;
  const { data, error } = await supabase
    .from('foods')
    .select('id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name')
    .order('name');
  if (!error && data) cachedFoods = data;
  return data ?? [];
}

export async function getCachedIngredients(supabase) {
  if (cachedIngredients) return cachedIngredients;
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g')
    .order('name');
  if (!error && data) cachedIngredients = data;
  return data ?? [];
}

export function invalidateFoodCache() {
  cachedFoods = null;
}

export function invalidateIngredientCache() {
  cachedIngredients = null;
}