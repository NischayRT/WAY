import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate } from '@/lib/dateUtils';
import SettingsClient from '@/components/settings/SettingsClient';
import { getAuthUser } from '@/lib/authServer';

// Never served from a cached render: it carries one user's profile down as props.
export const dynamic = 'force-dynamic';

const SECTIONS = ['profile', 'body', 'apps', 'account'];

// Only known codes map to text, so a crafted link can't put arbitrary text on screen.
const GH_ERRORS = {
  access_denied: 'Google Health access was not granted.',
  state_mismatch: 'The connection request expired. Please try again.',
  session_changed: 'You signed in as someone else while connecting. Please connect again.',
  missing_code: 'Google did not complete the connection. Please try again.',
  no_refresh_token: 'Google did not return a refresh token. Disconnect and reconnect.',
  token_exchange_failed: 'Google rejected the connection. Please try again.',
};

export default async function SettingsPage({ searchParams }) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect('/login');

  const params = await searchParams;
  const [{ data: profile }, { data: gh }, { data: firstWeight }, { data: lastWeight }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g, waist_cm, hip_cm, chest_cm, bicep_cm, dream_target_weight_kg, dream_target_date, step_goal, distance_goal_km, burn_goal_kcal'
      )
      .eq('id', user.id)
      .single(),
    supabase.from('google_health_connections').select('user_id, scopes, sync_enabled').eq('user_id', user.id).maybeSingle(),
    supabase.from('weight_logs').select('weight_kg').eq('user_id', user.id).order('logged_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('weight_logs').select('weight_kg').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!profile) redirect('/onboarding');

  let banner = null;
  if (params?.google_health_connected) {
    banner =
      params.google_health_write === 'missing'
        ? { type: 'error', message: 'Connected, but the food and body measurement permissions weren’t ticked on Google’s screen, so meals and weight won’t sync. Tap “Reconnect & allow” and tick every box.' }
        : { type: 'success', message: 'Google Health connected.' };
  } else if (params?.google_health_error) {
    banner = { type: 'error', message: `Could not connect Google Health. ${GH_ERRORS[params.google_health_error] ?? 'Please try again.'}` };
  }

  const scopes = gh?.scopes ?? '';
  const initialSection = banner ? 'apps' : SECTIONS.includes(params?.tab) ? params.tab : 'profile';

  return (
    <SettingsClient
      profile={profile}
      email={user.email ?? ''}
      initialSection={initialSection}
      initialBodyTab={params?.sub === 'goal' ? 'goal' : 'measure'}
      googleHealth={{
        connected: !!gh,
        canWrite: scopes.includes('nutrition.writeonly') && scopes.includes('health_metrics_and_measurements.writeonly'),
        syncEnabled: gh?.sync_enabled !== false,
      }}
      currentWeightKg={lastWeight?.weight_kg ?? profile.weight_kg}
      startKg={firstWeight?.weight_kg ?? null}
      today={todayLocalDate()}
      banner={banner}
    />
  );
}
