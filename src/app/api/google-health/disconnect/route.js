import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { revokeGoogleToken } from '@/lib/googleHealth';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Revoke our access at Google first (best effort), then forget the tokens.
  const { data: connection } = await supabase
    .from('google_health_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();
  if (connection?.refresh_token) await revokeGoogleToken(connection.refresh_token);

  const { error } = await supabase.from('google_health_connections').delete().eq('user_id', user.id);
  if (error) {
    console.error('[google-health/disconnect]', error.message);
    return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}