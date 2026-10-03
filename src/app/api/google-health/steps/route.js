import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyMetrics } from '@/lib/googleHealth';
import { todayLocalDate, isValidDateStr } from '@/lib/dateUtils';

// GET /api/google-health/steps?date=YYYY-MM-DD[&debug=1]
//
// Steps and distance for one calendar day. `date` defaults to today in the
// app's timezone. The dashboard sends the day being viewed, so browsing the
// week strip shows that day's activity rather than always today's.
export async function GET(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = todayLocalDate();
  const date = searchParams.get('date') ?? today;

  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD' }, { status: 400 });
  }
  if (date > today) {
    return NextResponse.json({ error: 'date cannot be in the future' }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) {
      return NextResponse.json({ connected: false, steps: null, distanceKm: null, caloriesBurned: null });
    }

    const metrics = await fetchDailyMetrics(accessToken, date);
    return NextResponse.json(
      { connected: true, date, ...metrics },
      // Short private cache: date-hopping in the week strip doesn't hammer
      // Google, while today's number is never more than ~30s stale.
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    );
  } catch (err) {
    if (err.reauthRequired) {
      return NextResponse.json(
        { connected: false, reauthRequired: true, error: err.message },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}