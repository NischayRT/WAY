import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { ui } from '@/lib/ui';
import AppHeader from '@/components/layout/AppHeader';
import WeighInForm from '@/components/weight/WeighInForm';
import WeightTrendChart from '@/components/weight/WeightTrendChart';
import WeightStats from '@/components/weight/WeightStats';
import WeightHistoryList from '@/components/weight/WeightHistoryList';

export const dynamic = 'force-dynamic';

// Enough history for a 30-day regression plus context. Ordered newest-first in
// the query so the limit keeps the MOST RECENT logs, then reversed for the
// chart, which needs ascending order.
const HISTORY_LIMIT = 90;

export default async function WeightPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: recentDesc }] = await Promise.all([
    supabase.from('profiles').select('height_cm, goal').eq('id', user.id).single(),
    supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const entries = [...(recentDesc ?? [])].reverse();

  return (
    <main className={ui.pageWrapWide}>
      <AppHeader title="Weight" backHref="/home" backLabel="Back to today" />

      {entries.length > 0 && (
        <WeightStats
          entries={entries}
          heightCm={profile?.height_cm ?? null}
          goal={profile?.goal ?? 'maintain'}
        />
      )}

      <div className={ui.card}>
        <WeightTrendChart entries={entries} />
      </div>

      <div className={ui.card}>
        <WeighInForm />
      </div>

      {entries.length > 0 && (
        <div className={ui.card}>
          <WeightHistoryList entries={entries} />
        </div>
      )}
    </main>
  );
}
