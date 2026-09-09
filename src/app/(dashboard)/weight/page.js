import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import WeighInForm from '@/components/weight/WeighInForm';
import WeightTrendChart from '@/components/weight/WeightTrendChart';

export default async function WeightPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: entries } = await supabase
    .from('weight_logs')
    .select('logged_at, weight_kg')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: true })
    .limit(30);

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader title="Weight" backHref="/home" backLabel="Back to today" />

      <div className={ui.card}>
        <WeightTrendChart entries={entries ?? []} />
      </div>

      <div className={ui.card}>
        <WeighInForm userId={user.id} />
      </div>

      {entries && entries.length > 0 && (
        <div className={ui.card}>
          <h2 className={ui.subheading}>History</h2>
          <ul className="mt-2 divide-y divide-stone">
            {[...entries].reverse().map((e) => (
              <li key={e.logged_at} className="flex justify-between py-2 text-sm">
                <span className="text-ink/60 dark:text-slate-400">{e.logged_at}</span>
                <span className="font-numeric font-medium">{e.weight_kg} kg</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
