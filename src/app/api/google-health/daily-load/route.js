import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyLoadInputs } from '@/lib/googleHealth';
import { readinessOn } from '@/lib/readiness';
import { describeDay } from '@/lib/dailyLoad';
import { todayLocalDate, isValidDateStr, addDays } from '@/lib/dateUtils';
import { getAuthUser } from '@/lib/authServer';
import { rateLimit } from '@/lib/rateLimit';

// GET /api/google-health/daily-load?date=YYYY-MM-DD&days=N
//
// Recovery, Strain and Sleep (lib/dailyLoad.js) for `date`, plus a per-day
// series for the `days` days ending on it (Activity page trend). Each part is
// null when the data it needs isn't there, so the UI can hide it.
export async function GET(request) {
  const supabase = await createServerSupabaseClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await rateLimit(supabase, 'google');
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const today = todayLocalDate();
  const q = searchParams.get('date');
  const date = isValidDateStr(q) && q <= today ? q : today;
  const days = Math.max(1, Math.min(31, Number(searchParams.get('days')) || 1));

  try {
    const token = await getValidAccessToken(supabase, user.id);
    if (!token) return NextResponse.json({ connected: false });

    const data = await fetchDailyLoadInputs(token, date, days);
    const byDay = Object.fromEntries(data.days.map((d) => [d.date, d]));
    const dates = Object.keys(byDay).sort();
    const recoveryFor = (d) => (byDay[d] ? readinessOn(byDay, d, dates)?.score ?? null : null);

    const day = describeDay(data.days, recoveryFor, date);
    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = addDays(date, -i);
      const x = describeDay(data.days, recoveryFor, d);
      series.push({ date: d, recovery: x.recovery?.score ?? null, strain: x.strain?.value ?? null, sleepMin: x.sleep?.minutes ?? null });
    }

    return NextResponse.json(
      { connected: true, date, ...day, series, needsPermission: data.needsPermission },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (err) {
    if (err.reauthRequired) return NextResponse.json({ connected: false, reauthRequired: true }, { status: 401 });
    console.error('[daily-load]', err?.message);
    return NextResponse.json({ error: 'Could not load recovery data' }, { status: 500 });
  }
}
