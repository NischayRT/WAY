// lib/userData.js
import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const getAuthenticatedUserAndProfile = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile, supabase };
});