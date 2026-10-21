import { headers } from 'next/headers';

// Set by middleware.js on each request after it verified the session; any
// copy sent by a client is stripped there first, on every path.
export const AUTH_UID_HEADER = 'x-way-uid';
export const AUTH_EMAIL_HEADER = 'x-way-email';

/**
 * The signed-in user on the server. Returns { id, email } or null.
 *
 * 1. Pages and API routes reuse the user middleware already verified for this
 *    very request (no second check).
 * 2. Otherwise getClaims(): verifies the session token locally on projects
 *    with asymmetric JWT signing keys (and refreshes it when needed); on the
 *    legacy shared secret it asks the Auth server, like getUser() did.
 * Middleware itself passes { trustMiddleware: false }.
 */
export async function getAuthUser(supabase, { trustMiddleware = true } = {}) {
  if (trustMiddleware) {
    try {
      const h = await headers();
      const id = h.get(AUTH_UID_HEADER);
      if (id) return { id, email: h.get(AUTH_EMAIL_HEADER) || null };
    } catch {
      // Outside a request scope: fall through to verifying the token.
    }
  }
  try {
    const { data, error } = await supabase.auth.getClaims();
    const c = data?.claims;
    if (error || !c?.sub) return null;
    return { id: c.sub, email: c.email ?? null };
  } catch {
    return null;
  }
}
