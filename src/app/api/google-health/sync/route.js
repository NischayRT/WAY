import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { isValidDateStr } from '@/lib/dateUtils';
import { syncFoodLogs, deleteFoodLogPoints, syncWeightLog, backfillGoogleHealth } from '@/lib/googleHealthSync';

// POST /api/google-health/sync
//   { action: 'food_upsert', logIds: [...] }   push / replace food logs
//   { action: 'food_delete', logIds: [...] }   remove their Google Health copies
//   { action: 'weight_upsert', date: 'YYYY-MM-DD' }
//   { action: 'set_enabled', enabled: true|false }   the Settings switch
//
const logIfFailed = (action, result) => {
  if (result && result.ok === false) console.warn('[google-health sync]', action, JSON.stringify(result));
  return result;
};

// Google problems are reported in the JSON body, never as an error status:
// the log itself is already saved in WAY, and the client ignores the result.
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

  // food_logs.id may be a uuid (string) or a bigint (number): accept both.
  // (The old string-only filter dropped numeric ids, so nothing was ever synced.)
  const ids = Array.isArray(body.logIds)
    ? body.logIds.filter((id) => typeof id === 'string' || typeof id === 'number').slice(0, 100)
    : [];

  switch (body.action) {
    case 'food_upsert':
      return NextResponse.json(logIfFailed('food_upsert', await syncFoodLogs(supabase, user.id, ids)));
    case 'food_delete':
      return NextResponse.json(logIfFailed('food_delete', await deleteFoodLogPoints(supabase, user.id, ids)));
    case 'weight_upsert':
      if (!isValidDateStr(body.date)) {
        return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
      }
      return NextResponse.json(logIfFailed('weight_upsert', await syncWeightLog(supabase, user.id, body.date)));
    case 'backfill':
      return NextResponse.json(await backfillGoogleHealth(supabase, user.id));
    case 'set_enabled': {
      const { error } = await supabase
        .from('google_health_connections')
        .update({ sync_enabled: !!body.enabled })
        .eq('user_id', user.id);
      if (error) {
        console.error('[google-health/sync] set_enabled', error.message);
        return NextResponse.json({ error: 'Could not update sync setting' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, enabled: !!body.enabled });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}