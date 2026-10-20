import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { revokeGoogleToken } from '@/lib/googleHealth';
import { decryptToken } from '@/lib/tokenCrypto';
import { getAuthUser } from '@/lib/authServer';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Revoke our access at Google first (best effort), then forget the tokens.
  const { data: connection } = await supabase
    .from('google_health_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();
  if (connection?.refresh_token) {
    let token = null;
    try {
      token = decryptToken(connection.refresh_token);
    } catch (err) {
      console.error('[google-health/disconnect] decrypt', err?.message);
    }
    if (token) await revokeGoogleToken(token);
  }

  const { error } = await supabase.from('google_health_connections').delete().eq('user_id', user.id);
  if (error) {
    console.error('[google-health/disconnect]', error.message);
    return NextResponse.json({ error: 'Could not disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}