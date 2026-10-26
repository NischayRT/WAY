// SERVER ONLY. A Supabase client with the service-role key, which bypasses
// row level security. Use it only in route handlers, and only for writes the
// browser must not be able to make itself (today: daily_stats, which friends,
// quests and duels trust). Always scope every query to the verified user.
//
// Never import this from a client component; the key must stay on the server
// (no NEXT_PUBLIC_ prefix).
import { createClient } from '@supabase/supabase-js';

let admin = null;

/** Returns the admin client, or null when SUPABASE_SERVICE_ROLE_KEY isn't set. */
export function getAdminClient() {
  if (typeof window !== 'undefined') throw new Error('supabaseAdmin is server-only');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  if (!admin) {
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
