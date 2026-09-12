import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request) {
  console.log('[middleware]', request.nextUrl.pathname);
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          // Write the refreshed cookies onto both the incoming request
          // (so this same middleware pass sees them) and a fresh response
          // (so the browser actually receives the updated session).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call is what actually triggers the refresh — it validates the
  // current session and, if the access token is near/past expiry, issues a
  // new one and pushes it through the setAll() above. Without calling this,
  // the client above is created but never does anything.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and image optimization
     * files, so the session stays fresh everywhere that matters without
     * doing unnecessary work on things like favicon.ico.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)',
  ],
};
