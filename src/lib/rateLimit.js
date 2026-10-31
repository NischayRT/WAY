import { NextResponse } from 'next/server';

// Per-user request limits for routes that call Google (each call spends the
// app's shared Google Cloud quota). Counted in the database
// (public.hit_rate_limit), so the limit holds across every serverless instance.
// The database owns the policy: since supabase/security-run2-2026-10.sql it
// ignores the limit and window sent here, so a caller can't loosen or reset
// them. Keep these numbers in step with that file (they're still sent, so
// older databases keep working, and the 429 Retry-After uses them).
//
// Limits are generous for real use: the home page asks for ~4 Google-backed
// endpoints per load.
export const LIMITS = {
  google: { limit: 240, windowSec: 10 * 60 }, // steps, vitals, tiles, daily-load, activity, body-age
  history: { limit: 30, windowSec: 60 * 60 }, // up to ~40 Google calls each
  sync: { limit: 120, windowSec: 10 * 60 }, // food / weight pushes to Google Health
  friends: { limit: 12, windowSec: 60 * 60 }, // fresh friends syncs that hit Google
};

/**
 * Count one request for the signed-in user. Returns null when allowed, or a
 * 429 response to return. If the counter itself is unavailable (migration
 * not run yet) the request is allowed and the problem is logged.
 */
export async function rateLimit(supabase, bucket) {
  const { limit, windowSec } = LIMITS[bucket];
  const { data, error } = await supabase.rpc('hit_rate_limit', { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSec });
  if (error) {
    console.error('[rateLimit]', bucket, error.message);
    return null;
  }
  if (data === false) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.min(windowSec, 600)) } }
    );
  }
  return null;
}
