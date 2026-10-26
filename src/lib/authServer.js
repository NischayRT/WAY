import { createHmac, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';

// Set by src/proxy.js on each request after it verified the session; any copy
// sent by a client is stripped there first, on every path. The proxy also
// signs them (x-way-auth), so a page or API route only trusts headers the
// proxy itself produced on this deployment: if the proxy were ever skipped,
// a client-sent x-way-uid would carry no valid signature and be ignored.
export const AUTH_UID_HEADER = 'x-way-uid';
export const AUTH_EMAIL_HEADER = 'x-way-email';
export const AUTH_SIG_HEADER = 'x-way-auth';

// Signing key derived from a server-only secret that is already configured
// (never NEXT_PUBLIC_). No secret, no header trust: routes then verify the
// session token themselves, which is slower but still correct.
let cachedKey;
function signingKey() {
  if (cachedKey !== undefined) return cachedKey;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TOKEN_ENCRYPTION_KEY || '';
  cachedKey = base ? createHmac('sha256', base).update('way:auth-header:v1').digest() : null;
  return cachedKey;
}

function mac(id, email) {
  const key = signingKey();
  if (!key) return null;
  return createHmac('sha256', key).update(`${id}\n${email ?? ''}`).digest('base64url');
}

/** The signature the proxy attaches for a verified user (null without a key). */
export function signIdentity(id, email) {
  return id ? mac(id, email) : null;
}

function validSignature(id, email, sig) {
  const want = mac(id, email);
  if (!want || !sig) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The signed-in user on the server. Returns { id, email } or null.
 *
 * 1. Pages and API routes reuse the user the proxy already verified for this
 *    very request, but only when its signature checks out.
 * 2. Otherwise getClaims(): verifies the session token locally on projects
 *    with asymmetric JWT signing keys (and refreshes it when needed); on the
 *    legacy shared secret it asks the Auth server, like getUser() did.
 * The proxy itself, and routes that write with the service-role key, pass
 * { trustMiddleware: false }.
 */
export async function getAuthUser(supabase, { trustMiddleware = true } = {}) {
  if (trustMiddleware) {
    try {
      const h = await headers();
      const id = h.get(AUTH_UID_HEADER);
      const email = h.get(AUTH_EMAIL_HEADER) || null;
      if (id && validSignature(id, email, h.get(AUTH_SIG_HEADER))) return { id, email };
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
