import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getDailyTargets } from '@/lib/bmrTdee';

// GET /api/targets — returns the logged-in user's daily calorie/macro targets
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
    .select('height_cm, weight_kg, age, sex, activity_level, goal')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const targets = getDailyTargets({
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    age: profile.age,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });

  return NextResponse.json(targets);
}
