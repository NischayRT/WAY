import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { addDays, isValidDateStr, todayLocalDate } from '@/lib/dateUtils';
import { MEAL_CATEGORIES } from '@/lib/mealCategories';

const MEAL_TYPES = MEAL_CATEGORIES.map((c) => c.value);
import { syncFoodLogs } from '@/lib/googleHealthSync';

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { targetDate, mealType } = body ?? {};

  // Without these checks any string reached the insert (junk dates, far
  // future dates, unknown meal types).
  if (!isValidDateStr(targetDate) || targetDate > todayLocalDate()) {
    return NextResponse.json({ error: 'targetDate must be a valid YYYY-MM-DD, not in the future' }, { status: 400 });
  }
  if (mealType != null && !MEAL_TYPES.includes(mealType)) {
    return NextResponse.json({ error: 'Unknown mealType' }, { status: 400 });
  }
  const yesterday = addDays(targetDate, -1);

  // Fetch yesterday's logs for this specific meal category (or all if not specified)
  let query = supabase
    .from('food_logs')
    .select('food_id, quantity_g, meal_type')
    .eq('user_id', user.id)
    .eq('logged_at', yesterday);

  if (mealType) {
    query = query.eq('meal_type', mealType);
  }

  const { data: previousLogs, error: fetchErr } = await query;
  if (fetchErr || !previousLogs || previousLogs.length === 0) {
    return NextResponse.json({ error: 'No logs found from yesterday to copy' }, { status: 404 });
  }

  const newRows = previousLogs.map((log) => ({
    user_id: user.id,
    food_id: log.food_id,
    quantity_g: log.quantity_g,
    meal_type: log.meal_type,
    logged_at: targetDate,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('food_logs')
    .insert(newRows)
    .select('id');
  if (insertErr) {
    console.error('[repeat-meal] insert failed:', insertErr.message);
    return NextResponse.json({ error: 'Could not copy meals' }, { status: 500 });
  }

  // Mirror into Google Health; a failure there must not fail the repeat.
  try {
    if (inserted?.length) await syncFoodLogs(supabase, user.id, inserted.map((r) => r.id));
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true, count: newRows.length });
}