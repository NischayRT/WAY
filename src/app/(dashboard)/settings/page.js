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

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g, waist_cm, hip_cm, chest_cm, bicep_cm'
    )
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  return (
    <main className={ui.pageWrap}>
      <div>
        <AppHeader title="Settings" backHref="/home" backLabel="Back to today" />
        <p className="mt-1 text-sm text-ink/60 dark:text-slate-400">
          Update your details or change your goal — your daily targets recalculate
          automatically.
        </p>
      </div>
      <SettingsClient initialProfile={profile} />
    </main>
  );
}