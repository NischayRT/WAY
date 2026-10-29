import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { todayLocalDate } from '@/lib/dateUtils';
import FriendsClient from '@/components/friends/FriendsClient';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export default async function CompetePage({ searchParams }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) redirect('/login');

  // username columns arrive with supabase/add-friends.sql; fall back without them.
  let { data: profile, error } = await supabase.from('profiles').select('id, full_name, username, username_changed_at').eq('id', user.id).maybeSingle();
  if (error) ({ data: profile } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).maybeSingle());

  if (!profile) redirect('/onboarding');

  return <FriendsClient userId={user.id} today={todayLocalDate()} profile={profile} initialTab={params?.tab} />;
}
