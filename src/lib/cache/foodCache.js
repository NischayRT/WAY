'use client';

// lib/cache/foodCache.js
//
// In-memory cache for the `foods` and `ingredients` reference tables,
// scoped to this browser tab's lifetime.
//
// Previously this "cache" had three problems that made it not really
// function as one:
//   1. No TTL — once populated, an entry never refreshed on its own.
//   2. invalidateFoodCache()/invalidateIngredientCache() existed but were
//      never called from anywhere, so the mutation paths that were
//      supposed to bust the cache (AddFoodForm inserting a dish,
//      IngredientSearch inserting an ingredient) never did.
//   3. getCachedIngredients() existed but nothing called it —
//      IngredientSearch.js and DishBuilder.js each ran their own separate
//      uncached `ingredients` fetch instead of sharing this one.
//
// This version fixes all three: a TTL acts as a safety net so a missed
// invalidation call heals itself in a few minutes instead of staying
// stale for the whole tab; in-flight de-duplication means two components
// mounting at once (e.g. DishBuilder + IngredientSearch) share one
// network call instead of firing two; and getCachedIngredients is now
// actually wired into both of its callers.
//
// Scope note: this is a per-browser-tab cache. Do not import it into a
// Server Component or route handler — module state on the server is
// shared across every user's requests on that instance, so caching a
// per-session Supabase query there can leak one user's rows into
// another user's response. (This is why lib/serverFoodCache.js and
// lib/clientFoodCache.js were removed rather than kept around unused —
// they were never wired in, but having three near-identical cache
// modules lying around is exactly how this kind of bug hides.) If
// server-side caching is wanted later, it has to be built around rows
// that are provably identical for every caller regardless of auth
// context — worth confirming against the `foods`/`ingredients` RLS
// policies before adding it back.

const TTL_MS = 5 * 60 * 1000; // 5 minutes — safety net, not the primary invalidation path

const state = {
  foods: { data: null, fetchedAt: 0, inFlight: null },
  ingredients: { data: null, fetchedAt: 0, inFlight: null },
};

function isFresh(entry) {
  return entry.data !== null && Date.now() - entry.fetchedAt < TTL_MS;
}

async function loadFoods(supabase) {
  const { data, error } = await supabase
    .from('foods')
    .select('id, name, region, calories_kcal, protein_g, carbs_g, fat_g, created_by, author_name')
    .order('id', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function loadIngredients(supabase) {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

function getOrFetch(key, loader, supabase) {
  const entry = state[key];
  if (isFresh(entry)) return Promise.resolve(entry.data);
  if (entry.inFlight) return entry.inFlight;

  entry.inFlight = loader(supabase)
    .then((data) => {
      entry.data = data;
      entry.fetchedAt = Date.now();
      entry.inFlight = null;
      return data;
    })
    .catch((err) => {
      entry.inFlight = null;
      throw err;
    });

  return entry.inFlight;
}

export function getCachedFoods(supabase) {
  return getOrFetch('foods', loadFoods, supabase);
}

export function getCachedIngredients(supabase) {
  return getOrFetch('ingredients', loadIngredients, supabase);
}

/** Synchronous peek so a component can skip its loading state entirely when the cache is already warm. Returns null if there's nothing fresh to show yet. */
export function peekCachedFoods() {
  return isFresh(state.foods) ? state.foods.data : null;
}

export function peekCachedIngredients() {
  return isFresh(state.ingredients) ? state.ingredients.data : null;
}

/** Call right after inserting/editing a food (e.g. AddFoodForm) so the next read is fresh instead of waiting out the TTL. */
export function invalidateFoodCache() {
  state.foods.data = null;
  state.foods.fetchedAt = 0;
}

/** Call right after inserting a new ingredient (e.g. IngredientSearch) so it shows up immediately for every consumer of this cache. */
export function invalidateIngredientCache() {
  state.ingredients.data = null;
  state.ingredients.fetchedAt = 0;
}
