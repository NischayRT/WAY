import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that must NOT trigger the profile-completeness redirect below:
// where an incomplete-profile user is supposed to land (/onboarding), pages
// that need no profile (/login, /auth/*, legal pages), and JSON APIs.
const PROFILE_CHECK_EXEMPT_PREFIXES = ['/onboarding', '/login', '/auth', '/api', '/privacy', '/terms'];

// Baseline browser security headers for every HTML/API response.
// A Content-Security-Policy is deliberately not set here yet (see notes):
// a wrong CSP breaks Supabase/Google sign-in, so roll it out as
// Report-Only first.
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

function withSecurityHeaders(response) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  return response;
}

// Supabase keeps the session in cookies named sb-<project>-auth-token
// (sometimes chunked .0/.1). No such cookie = signed out, so there is no
// session to refresh and no profile to check.
function hasSessionCookie(request) {
  return request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}

export async function middleware(request) {
  // Next.js link prefetches skip the auth round trip. This is only a
  // performance shortcut: every protected page still checks the user itself.
  const isPrefetch =
    request.headers.get('x-nextjs-router-prefetch') || request.headers.get('purpose') === 'prefetch';

  // Signed-out visitors (e.g. first load of /login or /) no longer wait on a
  // network call to Supabase before the page can start rendering. This was
  // a big part of the slow first paint on the login page.
  if (isPrefetch || !hasSessionCookie(request)) {
    return withSecurityHeaders(NextResponse.next());
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isExempt = PROFILE_CHECK_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Signed-in user with no profile row yet goes to /onboarding before any
  // protected page renders.
  if (user && !isExempt) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!profile) {
      const redirect = NextResponse.redirect(new URL('/onboarding', request.url));
      // Keep any refreshed auth cookies on the redirect too.
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return withSecurityHeaders(redirect);
    }
  }

  return withSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|woff2)$).*)'],
};
