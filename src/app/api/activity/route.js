// src/app/api/activity/route.js

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyMetrics } from '@/lib/googleHealth';
import { getValidStravaAccessToken, fetchStravaDailyMetrics } from '@/lib/strava';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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