import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { exchangeCodeForTokens, NUTRITION_WRITE_SCOPE, METRICS_WRITE_SCOPE, OPTIONAL_SCOPES } from '@/lib/googleHealth';

// Must match the list in ../connect/route.js. This said '/progress' while
// connect allowed '/activity', so connecting from the Activity page always
// landed on Settings instead.
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
  const requestedExtra = (request.cookies.get('gh_extra')?.value || '')
    .split(',')
    .filter((k) => Object.prototype.hasOwnProperty.call(OPTIONAL_SCOPES, k));

  // Every exit clears the one-time cookies.
  const redirectTo = (path) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.set('gh_oauth_state', '', { path: COOKIE_PATH, maxAge: 0 });
    response.cookies.set('gh_return_to', '', { path: COOKIE_PATH, maxAge: 0 });
    response.cookies.set('gh_extra', '', { path: COOKIE_PATH, maxAge: 0 });
    return response;
  };

  // Failures always land on /settings, because that's where the error
  // banner is shown — even when the flow started from onboarding.
  // Only short fixed codes go in the URL. The old version put raw error
  // text there and Settings printed it, so a crafted link could show any
  // message inside the app. Details go to the server log instead.
  const failure = (code, detail) => {
    if (detail) console.error('[google-health/callback]', code, detail);
    return redirectTo(`/settings?google_health_error=${code}`);
  };

  if (oauthError) return failure(oauthError === 'access_denied' ? 'access_denied' : 'oauth_error', oauthError);
  if (!code) return failure('missing_code');
  if (!expectedState || returnedState !== expectedState) return failure('state_mismatch');

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectTo('/login');

  let writeMissing = false;
  let extraMissing = [];
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
    // An optional permission (e.g. sleep) that was asked for but not granted:
    // either its box was left unticked, or the scope isn't added to the
    // app's Data access list in Google Cloud, so Google never offered it.
    extraMissing = requestedExtra.filter((k) => !granted.split(/\s+/).includes(OPTIONAL_SCOPES[k]));
    if (extraMissing.length) console.warn('[google-health/callback] not granted:', extraMissing.join(','), '| granted:', granted);
  } catch (err) {
    return failure('exchange_failed', err?.message);
  }

  // Settings shows a success banner via this flag; other destinations
  // (e.g. /home after onboarding) just show the steps badge.
  const missingParam = extraMissing.length ? `gh_missing=${extraMissing.join(',')}` : '';
  if (returnTo === '/settings') {
    const q = ['google_health_connected=1', writeMissing ? 'google_health_write=missing' : '', missingParam].filter(Boolean).join('&');
    return redirectTo(`/settings?${q}`);
  }
  return redirectTo(missingParam ? `${returnTo}?${missingParam}` : returnTo);
}