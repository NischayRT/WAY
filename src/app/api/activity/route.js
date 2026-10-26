// src/app/api/activity/route.js

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyMetrics } from '@/lib/googleHealth';
import { getValidStravaAccessToken, fetchStravaDailyMetrics } from '@/lib/strava';
import { isValidDateStr, todayLocalDate } from '@/lib/dateUtils';
import { getAuthUser } from '@/lib/authServer';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('date');
  // Only a real calendar date, not in the future; anything else means today.
  const dateStr = isValidDateStr(requested) && requested <= todayLocalDate() ? requested : null;

  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await rateLimit(supabase, 'google');

  if (limited) return limited;

  try {
    // 1. Check Google Health Connection
    const googleToken = await getValidAccessToken(supabase, user.id);
    if (googleToken) {
      const googleData = await fetchDailyMetrics(googleToken, dateStr);
      return NextResponse.json({
        connected: true,
        provider: 'google_health',
        steps: googleData.steps,
        distanceKm: googleData.distanceKm,
        caloriesBurned: googleData.caloriesBurned,
      });
    }

    // 2. Check Strava Connection as fallback
    const stravaToken = await getValidStravaAccessToken(supabase, user.id);
    if (stravaToken) {
      const stravaData = await fetchStravaDailyMetrics(stravaToken, dateStr);
      return NextResponse.json({
        connected: true,
        provider: 'strava',
        steps: stravaData.steps,
        distanceKm: stravaData.distanceKm,
      });
    }

    // Neither service is connected
    return NextResponse.json({ connected: false, steps: 0, distanceKm: 0, provider: null });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
