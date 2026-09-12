import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import SettingsClient from '@/components/settings/SettingsClient';

// This page must never be served from a cached render. It carries a
// specific user's auth.uid() and profile row down as props — if a stale
// cached version from a *different* (e.g. deleted/recreated) account ever
// got reused, the userId sent in a later save would no longer match the
// current session's auth.uid(), and Postgres would correctly reject the
// write as an RLS violation even though the policies themselves are fine.
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
      'full_name, height_cm, weight_kg, age, sex, activity_level, goal, override_calories, override_protein_g, override_carbs_g, override_fat_g'
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
      <SettingsClient userId={user.id} initialProfile={profile} />
    </main>
  );
}