import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import OnboardingClient from '@/components/onboarding/OnboardingClient';
import { getAuthUser } from '@/lib/authServer';

// Same reasoning as settings/page.js: never cache this page. It carries
// a specific user's id down as a prop, and a stale render from a
// different account would send a mismatched id on save.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) redirect('/login');

  // If a profile already exists, there's nothing to onboard — send them home.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingProfile) redirect('/home');

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:pt-10">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Welcome to WAY Studio</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Let&apos;s build your plan</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A few quick questions to set your daily calories and macros. Nothing is saved until you confirm your plan.
        </p>
      </div>
      <OnboardingClient />
    </main>
  );
}
