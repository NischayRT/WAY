import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchExtraTiles, EXTRA_TILE_FETCHERS } from '@/lib/googleHealth';
import { todayLocalDate, isValidDateStr } from '@/lib/dateUtils';

// GET /api/google-health/tiles?date=YYYY-MM-DD&keys=heart,floors,sleep
//
// Data for the optional home tiles the user has switched on. Each key comes
// back independently as { data }, { needsPermission: true } or { error: true },
// so one missing permission or failed call never blanks the other tiles.
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
  const keys = (searchParams.get('keys') || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => Object.prototype.hasOwnProperty.call(EXTRA_TILE_FETCHERS, k))
    .slice(0, 10);
  if (!keys.length) return NextResponse.json({ connected: true, tiles: {} });

  try {
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) return NextResponse.json({ connected: false, tiles: {} });
    const tiles = await fetchExtraTiles(accessToken, date, keys);
    return NextResponse.json({ connected: true, date, tiles }, { headers: { 'Cache-Control': 'private, max-age=120' } });
  } catch (err) {
    if (err.reauthRequired) return NextResponse.json({ connected: false, reauthRequired: true }, { status: 401 });
    console.error('[google-health/tiles]', err?.message);
    return NextResponse.json({ error: 'Could not load tiles from Google Health' }, { status: 500 });
  }
}
