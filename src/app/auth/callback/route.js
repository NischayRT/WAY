import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

// OAuth (Google) return URL. Previously this redirected to /home whether or
// not the code exchange succeeded, so a failed or replayed sign-in bounced
// the user between /home and /login with no explanation.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/home`);
}
