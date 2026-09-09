import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import BodyStudio from '@/components/body/BodyStudio';

export default async function BodyStudioPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  return (
    <main className={ui.pageWrap}>
      <AppHeader title="Physique Studio" backHref="/home" backLabel="Back to today" />
      <BodyStudio profile={profile} />
    </main>
  );
}