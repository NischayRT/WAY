import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchDailyHistory, fetchExtraHistory } from '@/lib/googleHealth';
import { todayLocalDate, addDays } from '@/lib/dateUtils';
import { getAuthUser } from '@/lib/authServer';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';

// POST /api/friends/sync[?force=1]
//
// Copies the signed-in user's own daily totals into daily_stats (last 31
// days), which is what friends see, and only through the agreed fields
// (see supabase/add-friends.sql). Steps, distance, active calories, floors,
// sleep and resting heart rate come from Google Health when connected;
// calories and protein from food_logs; weight from weight_logs.
// Runs at most every 30 minutes unless forced.
//
// Browsers can't write daily_stats (see supabase/security-fixes-2026-10.sql),
// so the write uses the server-only service-role client, always scoped to the
// verified user.
const WINDOW = 31;
const FRESH_MS = 30 * 60 * 1000;

const round = (v, dp = 0) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** dp) / 10 ** dp);

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  // Verify the session token itself here (not the proxy header): the
  // service-role write below has no RLS behind it.
  const user = await getAuthUser(supabase, { trustMiddleware: false });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) {
    console.error('[friends/sync] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json({ error: 'Friends sharing isn’t set up on the server yet.', setup: true }, { status: 503 });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  const today = todayLocalDate();
  const from = addDays(today, -(WINDOW - 1));

  const { data: latest, error: readError } = await supabase
    .from('daily_stats')
    .select('updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    // Most likely supabase/add-friends.sql hasn't been run yet.
    return NextResponse.json({ error: 'Friends isn’t set up on the server yet.', setup: true }, { status: 503 });
  }
  if (!force && latest && Date.now() - new Date(latest.updated_at).getTime() < FRESH_MS) {
    return NextResponse.json({ skipped: 'fresh', updatedAt: latest.updated_at });
  }

  // Only syncs that will actually go to Google count against the limit.
  const limited = await rateLimit(supabase, 'friends');
  if (limited) return limited;

  const rows = new Map();
  const row = (day) => {
    if (!rows.has(day)) rows.set(day, { user_id: user.id, day });
    return rows.get(day);
  };

  // Food and weight from WAY itself.
  const [{ data: logs }, { data: weights }] = await Promise.all([
    supabase.from('food_logs').select('quantity_g, logged_at, foods (calories_kcal, protein_g)').eq('user_id', user.id).gte('logged_at', from).lte('logged_at', today),
    supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).gte('logged_at', from).lte('logged_at', today),
  ]);
  const food = new Map();
  for (const l of logs ?? []) {
    const r = (Number(l.quantity_g) || 0) / 100;
    const t = food.get(l.logged_at) ?? { k: 0, p: 0 };
    t.k += (Number(l.foods?.calories_kcal) || 0) * r;
    t.p += (Number(l.foods?.protein_g) || 0) * r;
    food.set(l.logged_at, t);
  }
  for (const [day, t] of food) Object.assign(row(day), { calories_in: Math.round(t.k), protein_g: Math.round(t.p) });
  for (const w of weights ?? []) row(w.logged_at).weight_kg = round(w.weight_kg, 1);

  // Activity from Google Health, if connected. A failure here still saves the rest.
  let google = 'not_connected';
  try {
    const token = await getValidAccessToken(supabase, user.id);
    if (token) {
      const [days, extras] = await Promise.all([
        fetchDailyHistory(token, from, today),
        fetchExtraHistory(token, from, today, ['heart', 'floors', 'sleep']),
      ]);
      for (const d of days ?? []) {
        Object.assign(row(d.date), {
          steps: round(d.steps),
          distance_km: round(d.distanceKm, 2),
          active_kcal: round(d.activeCalories),
        });
      }
      const series = (key, name) => extras?.[key]?.data?.series?.[name] ?? [];
      for (const p of series('heart', 'resting')) if (p.value != null) row(p.date).resting_hr = round(p.value);
      for (const p of series('floors', 'floors')) if (p.value != null) row(p.date).floors = round(p.value);
      for (const p of series('sleep', 'sleepHours')) if (p.value != null) row(p.date).sleep_hours = round(p.value, 2);
      google = 'ok';
    }
  } catch (err) {
    google = err?.reauthRequired ? 'reauth' : 'error';
    if (!err?.reauthRequired) console.error('[friends/sync] google', err?.message);
  }

  const now = new Date().toISOString();
  // When Google Health didn't answer, leave yesterday's activity numbers as they are.
  const ACTIVITY = ['steps', 'distance_km', 'active_kcal', 'floors', 'sleep_hours', 'resting_hr'];
  const KEYS = [...(google === 'ok' ? ACTIVITY : []), 'weight_kg', 'calories_in', 'protein_g'];
  const payload = [...rows.values()]
    .filter((r) => KEYS.some((k) => r[k] != null))
    .map((r) => ({ ...Object.fromEntries(KEYS.map((k) => [k, r[k] ?? null])), user_id: r.user_id, day: r.day, updated_at: now }));

  if (payload.length) {
    const { error } = await admin.from('daily_stats').upsert(payload, { onConflict: 'user_id,day' });
    if (error) {
      console.error('[friends/sync] upsert', error.message);
      return NextResponse.json({ error: 'Could not update' }, { status: 500 });
    }
  }
  // Keep only the window friends can see.
  await admin.from('daily_stats').delete().eq('user_id', user.id).lt('day', from);

  return NextResponse.json({ updated: payload.length, google, updatedAt: now });
}
