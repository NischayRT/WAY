import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { buildAuthUrl, OPTIONAL_SCOPES } from '@/lib/googleHealth';
import { getAuthUser } from '@/lib/authServer';

// Only these paths may be used as a post-connect destination. Anything
// else (including an attacker-supplied URL) falls back to /settings, so
// this can't be turned into an open redirect.
const ALLOWED_RETURN_TO = ['/settings', '/home', '/activity'];

export async function GET(request) {
  const { origin, searchParams, host } = new URL(request.url);

  // The OAuth state cookie must be set on the same host Google sends the user
  // back to (GOOGLE_HEALTH_REDIRECT_URI). If the user is on the other host
  // (www vs no-www, or the old vercel.app address), restart the flow there;
  // otherwise the callback can't find the cookie and the connect fails.
  try {
    const callbackHost = new URL(process.env.GOOGLE_HEALTH_REDIRECT_URI).host;
    const forwardedHost = request.headers.get('x-forwarded-host') || host;
    if (callbackHost && forwardedHost !== callbackHost && !forwardedHost.startsWith('localhost')) {
      const target = new URL(request.url);
      target.host = callbackHost;
      target.protocol = 'https:';
      target.port = '';
      return NextResponse.redirect(target.toString());
    }
  } catch {
    // GOOGLE_HEALTH_REDIRECT_URI missing or invalid: carry on as before
  }
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) return NextResponse.redirect(`${origin}/login`);

  const requested = searchParams.get('returnTo');
  const returnTo = ALLOWED_RETURN_TO.includes(requested) ? requested : '/settings';

  // Random state, echoed back by Google and compared against this cookie
  // in the callback — proves the callback belongs to a flow this browser
  // actually started.
  const state = randomBytes(16).toString('hex');

  // Optional permissions for tiles that need them, e.g. ?extra=sleep,irn.
  // Whitelisted keys only; anything else is ignored.
  const extra = (searchParams.get('extra') || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => Object.prototype.hasOwnProperty.call(OPTIONAL_SCOPES, x));

  const response = NextResponse.redirect(buildAuthUrl(state, extra));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // lax so the cookie survives the top-level redirect back from Google
    path: '/api/google-health',
    maxAge: 60 * 10,
  };
  response.cookies.set('gh_oauth_state', state, cookieOptions);
  // Which WAY user started this connect: the callback stores the Google
  // tokens only if that same user is still the one signed in.
  response.cookies.set('gh_oauth_owner', user.id, cookieOptions);
  response.cookies.set('gh_return_to', returnTo, cookieOptions);
  // So the callback can tell whether Google actually granted what was asked.
  response.cookies.set('gh_extra', extra.join(','), cookieOptions);
  return response;
}
