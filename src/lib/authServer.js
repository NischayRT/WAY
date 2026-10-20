/**
 * The signed-in user on the server, without a round trip to Supabase Auth
 * when the project uses asymmetric JWT signing keys: getClaims() verifies the
 * session token locally (and refreshes it when needed). On projects still on
 * the legacy shared secret it falls back to asking the Auth server, exactly
 * like getUser() did. Returns { id, email } or null.
 */
export async function getAuthUser(supabase) {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const c = data?.claims;
    if (error || !c?.sub) return null;
    return { id: c.sub, email: c.email ?? null };
  } catch {
    return null;
  }
}
