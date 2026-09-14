import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)',
  ],
};