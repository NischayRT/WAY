import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { exchangeCodeForTokens, NUTRITION_WRITE_SCOPE, METRICS_WRITE_SCOPE } from '@/lib/googleHealth';

// Must match the list in ../connect/route.js (it said '/progress' here but
// '/activity' there, so returning to Activity silently fell back to Settings).
const ALLOWED_RETURN_TO = ['/settings', '/home', '/activity'];
const COOKIE_PATH = '/api/google-health';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const returnedState = searchParams.get('state');

  const expectedState = request.cookies.get('gh_oauth_state')?.value;
  const cookieReturnTo = request.cookies.get('gh_return_to')?.value;
  const returnTo = ALLOWED_RETURN_TO.includes(cookieReturnTo) ? cookieReturnTo : '/settings';

  // Every exit clears the one-time cookies.
  const redirectTo = (path) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.set('gh_oauth_state', '', { path: COOKIE_PATH, maxAge: 0 });
    response.cookies.set('gh_return_to', '', { path: COOKIE_PATH, maxAge: 0 });
    return response;
  };

  // Failures always land on /settings, where the error banner is shown.
  // Only fixed codes go in the URL. Free text here used to be displayed
  // verbatim by Settings, so anyone could send a victim a link like
  // /settings?google_health_error=<fake security warning> rendered inside
  // the real app.
  const failure = (code) => redirectTo(`/settings?google_health_error=${code}`);

  if (oauthError) return failure(oauthError === 'access_denied' ? 'access_denied' : 'oauth_error');
  if (!code) return failure('missing_code');
  if (!expectedState || returnedState !== expectedState) return failure('state_mismatch');

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectTo('/login');

  let writeMissing = false;
  try {
    const tokens = await exchangeCodeForTokens(code);

    // prompt=consent should make Google return a refresh_token every
    // time; guard anyway rather than store a row that can never refresh.
    if (!tokens.refresh_token) {
      return failure('no_refresh_token');
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await supabase.from('google_health_connections').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      // Google returns only what the user ticked on the consent screen, so
      // this is the source of truth for whether we may write.
      scopes: tokens.scope ?? null,
      sync_enabled: true,
    });

    if (error) throw error;

    // Granular consent: the user can untick the food / body-measurement boxes.
    const granted = tokens.scope ?? '';
    writeMissing = !(granted.includes(NUTRITION_WRITE_SCOPE) && granted.includes(METRICS_WRITE_SCOPE));
  } catch (err) {
    console.error('[google-health/callback]', err?.message ?? err);
    return failure('token_exchange_failed');
  }

  // Settings shows a success banner via this flag; other destinations
  // (e.g. /home after onboarding) just show the steps badge.
  if (returnTo === '/settings') {
    return redirectTo(
      writeMissing
        ? '/settings?google_health_connected=1&google_health_write=missing'
        : '/settings?google_health_connected=1'
    );
  }
  return redirectTo(returnTo);
}