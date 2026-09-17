import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import AddFoodForm from '@/components/logging/AddFoodForm';

export default async function AddFoodPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  return (
    <main className={ui.pageWrap}>
      <div>
        <AppHeader title="Add your own dish" backHref="/log-food" backLabel="Back to log food" />
        <p className="mt-1 text-sm text-ink/60 dark:text-slate-400">
          Anyone can see and log this dish once you save it — they just can&apos;t edit or
          delete it.
        </p>
      </div>
      <AddFoodForm authorName={profile?.full_name} />
    </main>
  );
}

