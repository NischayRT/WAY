import { createClient } from '@/lib/supabaseClient';

/**
 * Returns the signed-in user id from the live session.
 *
 * Every insert/update that writes a user-scoped row should call this inside
 * its handler instead of receiving an id as a prop. Props go stale, get
 * dropped during refactors, and silently become undefined — which Supabase
 * strips from the payload, leaving Postgres to reject a NULL user_id.
 *
 * @param {object} [supabase] existing browser client; one is created if omitted
 * @throws when there is no active session
 */
export async function getCurrentUserId(supabase = createClient()) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  return user.id;
}
