import { createBrowserClient } from '@supabase/ssr';

// Client-side Supabase instance — used in components/forms.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_SUPABASE_URL,
    process.env.NEXT_SUPABASE_ANON_KEY
  );
}
