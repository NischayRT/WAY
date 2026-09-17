import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveDailyTargets } from '@/lib/bmrTdee';

// GET /api/targets — returns the logged-in user's daily calorie/macro targets
//
// This used to call getDailyTargets() and ignore the override_* columns, so
// a user with custom targets saw their computed numbers here while every
// other screen (which uses resolveDailyTargets) showed the overrides.
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
    )
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(resolveDailyTargets(profile));
}
