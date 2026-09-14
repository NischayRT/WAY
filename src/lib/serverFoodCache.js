// lib/serverFoodCache.js
import { unstable_cache } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const getPublicFoodsCached = unstable_cache(
  async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('foods')
      .select('id, name, region, calories_kcal, protein_g, carbs_g, fat_g')
      .is('created_by', null);
    return data ?? [];
  },
  ['public-foods-cache'],
  { revalidate: 3600, tags: ['foods'] }
);