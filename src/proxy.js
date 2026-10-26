import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAuthUser, signIdentity, AUTH_UID_HEADER, AUTH_EMAIL_HEADER, AUTH_SIG_HEADER } from '@/lib/authServer';
import { SECURITY_HEADERS } from '@/lib/securityHeaders.mjs';

// Next.js 16 runs this file before every matched request (it replaced
// middleware.js). It refreshes the Supabase session, sends people without a
// profile to onboarding, hands the verified user to the page (signed, see
// lib/authServer.js), guards the JSON API against cross-site writes and sets
// the browser security headers.

// Routes that must NOT trigger the profile-completeness redirect below:
// where an incomplete-profile user is supposed to land (/onboarding), pages
// that need no profile (/login, /auth/*, legal pages), and JSON APIs.
const PROFILE_CHECK_EXEMPT_PREFIXES = ['/onboarding', '/login', '/auth', '/api', '/privacy', '/terms'];

function withSecurityHeaders(response) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
}

// Cross-site request forgery guard for the JSON API: a request that changes
// something (POST/PUT/PATCH/DELETE) must come from this site's own pages.
// Browsers always send Origin (and Sec-Fetch-Site) on such requests, so a
// form or script on another website is refused even if the user is signed
// in. Same-origin fetches from the app are unaffected.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function isCrossSiteWrite(request) {
  if (SAFE_METHODS.has(request.method)) return false;
  if (!request.nextUrl.pathname.startsWith('/api/')) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false; // non-browser clients still need a valid session cookie
  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

// API writes that carry a body must send it as JSON. A plain HTML form on
// another site can only send form or text bodies, so this closes the door on
// "simple" cross-site posts even for browsers that don't send Origin.
function isNonJsonApiBody(request) {
  if (SAFE_METHODS.has(request.method)) return false;
  if (!request.nextUrl.pathname.startsWith('/api/')) return false;
  const length = Number(request.headers.get('content-length') || 0);
  const chunked = !!request.headers.get('transfer-encoding');
  if (!length && !chunked) return false; // no body (e.g. POST /api/friends/sync)
  const type = (request.headers.get('content-type') || '').toLowerCase();
  return !type.startsWith('application/json');
}

// Supabase keeps the session in cookies named sb-<project>-auth-token
// (sometimes chunked .0/.1). No such cookie = signed out, so there is no
// session to refresh and no profile to check.
function hasSessionCookie(request) {
  return request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}

export async function proxy(request) {
  if (isCrossSiteWrite(request)) {
    return withSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
  }
  if (isNonJsonApiBody(request)) {
    return withSecurityHeaders(NextResponse.json({ error: 'Send JSON' }, { status: 415 }));
  }

  // Supabase falls back to the Site URL root (/?code=...) when the return
  // address it was given isn't on its Redirect URLs list (e.g. www vs no-www).
  // Finish the sign-in instead of leaving the user on the landing page.
  const { pathname: path, searchParams: params } = request.nextUrl;
  if (path === '/' && params.has('code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  // Next.js link prefetches skip the auth round trip. This is only a
  // performance shortcut: every protected page still checks the user itself.
  const isPrefetch =
    request.headers.get('x-nextjs-router-prefetch') || request.headers.get('purpose') === 'prefetch';

  // Signed-out visitors (e.g. first load of /login or /) no longer wait on a
  // network call to Supabase before the page can start rendering. This was
  // a big part of the slow first paint on the login page.
  if (isPrefetch || !hasSessionCookie(request)) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: forwardHeaders(request, null) } }));
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const user = await getAuthUser(supabase, { trustMiddleware: false });

  const { pathname } = request.nextUrl;
  const isExempt = PROFILE_CHECK_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Signed-in user with no profile row yet goes to /onboarding before any
  // protected page renders. Once a profile is found it is remembered in a
  // small cookie (tied to the user id), so later requests skip the database
  // round trip. API routes check auth themselves and never redirect here.
  const isApi = pathname.startsWith('/api/');
  const knownProfile = user && request.cookies.get(PROFILE_OK_COOKIE)?.value === user.id;
  if (user && !isExempt && !isApi && !knownProfile) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (profile) {
      response.cookies.set(PROFILE_OK_COOKIE, user.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    } else {
      const redirect = NextResponse.redirect(new URL('/onboarding', request.url));
      // Keep any refreshed auth cookies on the redirect too.
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return withSecurityHeaders(redirect);
    }
  }

  // Hand the verified user to the page / API route on this same request, so
  // it doesn't verify the session a second time (lib/authServer.js). Cookies
  // refreshed above are already in request.headers; copy them onto the reply.
  const final = NextResponse.next({ request: { headers: forwardHeaders(request, user) } });
  response.cookies.getAll().forEach((c) => final.cookies.set(c));
  return withSecurityHeaders(final);
}

// Request headers for the page with the verified user set, and any copy a
// client tried to send itself removed first, on every path.
function forwardHeaders(request, user) {
  const h = new Headers(request.headers);
  h.delete(AUTH_UID_HEADER);
  h.delete(AUTH_EMAIL_HEADER);
  h.delete(AUTH_SIG_HEADER);
  if (user?.id) {
    h.set(AUTH_UID_HEADER, user.id);
    if (user.email) h.set(AUTH_EMAIL_HEADER, user.email);
    const sig = signIdentity(user.id, user.email ?? null);
    if (sig) h.set(AUTH_SIG_HEADER, sig);
  }
  return h;
}

const PROFILE_OK_COOKIE = 'way_profile_ok';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|woff2)$).*)'],
};
