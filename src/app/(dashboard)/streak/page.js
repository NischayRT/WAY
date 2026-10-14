import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { todayLocalDate } from '@/lib/dateUtils';
import { loadLoginStreak, loadStreak, recordVisit } from '@/lib/streak';
import StreakClient from '@/components/streak/StreakClient';

export const dynamic = 'force-dynamic';

export default async function StreakPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = todayLocalDate();
  await recordVisit(supabase, user.id, today);
  const [login, food, { data: profile }] = await Promise.all([
    loadLoginStreak(supabase, user.id, today),
    loadStreak(supabase, user.id, today),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  return <StreakClient login={login} food={food} today={today} name={(profile?.full_name || '').split(' ')[0]} />;
}
