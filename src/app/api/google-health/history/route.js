import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyHistory, fetchExtraHistory } from '@/lib/googleHealth';
import { todayLocalDate, isValidDateStr, addDays } from '@/lib/dateUtils';

const MAX_SPAN_DAYS = 366;

// GET /api/google-health/history?from=YYYY-MM-DD&to=YYYY-MM-DD[&keys=heart,sleep,...]
//
// Per-day steps, distance (km) and calories burned for the Activity page,
// plus optional series for the stats the user picked (`keys`): heart,
// oxygen, floors, sleep, glucose. Each optional key comes back on its own
// as { data } | { needsPermission } | { error }.
export async function GET(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = todayLocalDate();
  const from = searchParams.get('from');
  let to = searchParams.get('to') ?? today;

  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json({ error: 'from and to must be valid YYYY-MM-DD dates' }, { status: 400 });
  }
  if (to > today) to = today;
  if (from > to) {
    return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
  }
  if (from < addDays(to, -(MAX_SPAN_DAYS - 1))) {
    return NextResponse.json({ error: `Range is limited to ${MAX_SPAN_DAYS} days` }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) return NextResponse.json({ connected: false, days: [] });

    const keys = (searchParams.get('keys') || '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => ['heart', 'oxygen', 'floors', 'sleep', 'glucose'].includes(k));
    const [days, extras] = await Promise.all([
      fetchDailyHistory(accessToken, from, to),
      keys.length ? fetchExtraHistory(accessToken, from, to, keys) : Promise.resolve({}),
    ]);
    return NextResponse.json(
      { connected: true, from, to, days, extras },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (err) {
    if (err.reauthRequired) {
      return NextResponse.json({ connected: false, reauthRequired: true, days: [] }, { status: 401 });
    }
    console.error('[api]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
