import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import OnboardingClient from '@/components/onboarding/OnboardingClient';

// Same reasoning as settings/page.js: never cache this page. It carries
// a specific user's id down as a prop, and a stale render from a
// different account would send a mismatched id on save.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // If a profile already exists, there's nothing to onboard — send them home.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingProfile) redirect('/home');

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Set up your profile</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          We use this to calculate your daily calorie and macro targets.
        </p>
      </div>
      <OnboardingClient />
    </main>
  );
}