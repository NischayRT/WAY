import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import SettingsClient from '@/components/settings/SettingsClient';

// This page must never be served from a cached render: it carries a
// specific user's profile row down as props, and a stale render from a
// different account would show the wrong details. Writes themselves no
// longer depend on this — forms resolve the user id from the live session
// at save time rather than trusting a prop.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: googleHealthConnection }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g, waist_cm, hip_cm, chest_cm, bicep_cm, dream_target_weight_kg, dream_target_date, step_goal, distance_goal_km, burn_goal_kcal'
      )
      .eq('id', user.id)
      .single(),
    supabase
      .from('google_health_connections')
      .select('user_id, scopes, sync_enabled')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!profile) redirect('/onboarding');

  return (
    <main className={`${ui.pageWrapWide} lg:px-8`}>
      <div>
        <AppHeader title="Settings" backHref="/home" backLabel="Back to today" />
        <p className="mt-1 text-sm text-slate-500 dark:text-sky-400">
          Update your details or change your goal — your daily targets recalculate
          automatically.
        </p>
      </div>
      <SettingsClient
        initialProfile={profile}
        googleHealthConnected={!!googleHealthConnection}
        googleHealthSync={{
          enabled: googleHealthConnection?.sync_enabled !== false,
          canWrite:
            (googleHealthConnection?.scopes ?? '').includes('nutrition.writeonly') &&
            (googleHealthConnection?.scopes ?? '').includes('health_metrics_and_measurements.writeonly'),
        }}
      />
    </main>
  );
}