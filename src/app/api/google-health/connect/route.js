import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { buildAuthUrl } from '@/lib/googleHealth';

// Only these paths may be used as a post-connect destination. Anything
// else (including an attacker-supplied URL) falls back to /settings, so
// this can't be turned into an open redirect.
const ALLOWED_RETURN_TO = ['/settings', '/home', '/activity'];

export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/login`);

  const requested = searchParams.get('returnTo');
  const returnTo = ALLOWED_RETURN_TO.includes(requested) ? requested : '/settings';

  // Random state, echoed back by Google and compared against this cookie
  // in the callback — proves the callback belongs to a flow this browser
  // actually started.
  const state = randomBytes(16).toString('hex');

  const response = NextResponse.redirect(buildAuthUrl(state));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // lax so the cookie survives the top-level redirect back from Google
    path: '/api/google-health',
    maxAge: 60 * 10,
  };
  response.cookies.set('gh_oauth_state', state, cookieOptions);
  response.cookies.set('gh_return_to', returnTo, cookieOptions);
  return response;
}
