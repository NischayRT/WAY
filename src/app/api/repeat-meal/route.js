import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { addDays } from '@/lib/dateUtils';

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetDate, mealType } = await request.json();
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

  const { error: insertErr } = await supabase.from('food_logs').insert(newRows);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: newRows.length });
}