import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that must NOT trigger the profile-completeness redirect below —
// either because they're where an incomplete-profile user is already
// supposed to land (/onboarding), don't require a profile at all
// (/login, /auth/*), or would break if redirected instead of returning
// JSON (/api/*).
const PROFILE_CHECK_EXEMPT_PREFIXES = ['/onboarding', '/login', '/auth', '/api', '/privacy', '/terms'];

export async function middleware(request) {
  // If this is a Next.js prefetch request (from hovering over desktop links),
  // skip expensive auth validation roundtrips.
  const isPrefetch =
    request.headers.get('x-nextjs-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch';

  if (isPrefetch) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isExempt = PROFILE_CHECK_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  // A logged-in user with no profile row yet (brand new signup, any auth
  // method) gets sent to /onboarding here, before /home (or any other
  // protected route) ever starts rendering — this is what removes the
  // "today skeleton flashes before onboarding" race, since the redirect
  // now happens at the routing layer instead of inside the page itself.
  // Deliberately a minimal existence check (just `id`), not the full
  // profile row each page already fetches for its own use — this adds
  // one small indexed lookup per authenticated navigation, not a
  // duplicate of the heavier per-page fetch.
  if (user && !isExempt) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)',
  ],
};