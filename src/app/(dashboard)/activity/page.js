import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { todayLocalDate } from '@/lib/dateUtils';
import ActivityClient from '@/components/activity/ActivityClient';

export const dynamic = 'force-dynamic';

// Up to two years of weigh-ins; the page filters them to the chosen range.
const WEIGHT_HISTORY_LIMIT = 730;

export default async function ActivityPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: recentDesc }, { data: connection }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'height_cm, weight_kg, age, sex, goal, activity_level, step_goal, distance_goal_km, burn_goal_kcal, waist_cm, hip_cm, chest_cm, bicep_cm, dream_target_weight_kg, dream_target_date'
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(WEIGHT_HISTORY_LIMIT),
    supabase.from('google_health_connections').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profile) redirect('/onboarding');

  return (
    <ActivityClient
      userId={user.id}
      profile={profile}
      entries={[...(recentDesc ?? [])].reverse()}
      goals={{
        steps: profile.step_goal ?? null,
        distanceKm: profile.distance_goal_km ? Number(profile.distance_goal_km) : null,
        burnKcal: profile.burn_goal_kcal ?? null,
      }}
      googleHealthConnected={!!connection}
      today={todayLocalDate()}
    />
  );
}
