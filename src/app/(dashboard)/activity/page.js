import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { ui } from '@/lib/ui';
import { todayLocalDate } from '@/lib/dateUtils';
import AppHeader from '@/components/layout/AppHeader';
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
      .select('height_cm, goal, step_goal, distance_goal_km, burn_goal_kcal')
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

  const entries = [...(recentDesc ?? [])].reverse();

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader title="Activity" backHref="/home" backLabel="Back to today" />

      <ActivityClient
        entries={entries}
        heightCm={profile?.height_cm ?? null}
        goal={profile?.goal ?? 'maintain'}
        goals={{
          steps: profile?.step_goal ?? null,
          distanceKm: profile?.distance_goal_km ? Number(profile.distance_goal_km) : null,
          burnKcal: profile?.burn_goal_kcal ?? null,
        }}
        googleHealthConnected={!!connection}
        today={todayLocalDate()}
      />
    </main>
  );
}
