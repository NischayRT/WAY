import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchVitals } from '@/lib/googleHealth';
import { todayLocalDate, isValidDateStr } from '@/lib/dateUtils';

// GET /api/google-health/vitals?date=YYYY-MM-DD
//
// Most recent resting heart rate, SpO2 and VO2 max on or before `date`
// (each within the last 7 days), with the date each value belongs to.
//   { connected, needsPermission?, restingHeartRate, spo2, vo2Max }
export async function GET(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = todayLocalDate();
  const date = searchParams.get('date') ?? today;
  if (!isValidDateStr(date) || date > today) {
    return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD, not in the future' }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) return NextResponse.json({ connected: false });

    const vitals = await fetchVitals(accessToken, date);
    return NextResponse.json(
      { connected: true, date, ...vitals },
      // Daily summaries change rarely: a few minutes of private caching is plenty.
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (err) {
    if (err.permissionDenied) {
      // Connected before vitals were added: needs to reconnect once.
      return NextResponse.json({ connected: true, needsPermission: true });
    }
    if (err.reauthRequired) {
      return NextResponse.json({ connected: false, reauthRequired: true }, { status: 401 });
    }
    console.error('[google-health/vitals]', err?.message);
    return NextResponse.json({ error: 'Could not load vitals from Google Health' }, { status: 500 });
  }
}
