// lib/googleHealthSync.js
//
// Server-only. Pushes food logs (calories + macros) and weigh-ins from WAY
// into Google Health via the Google Health API (v4), and removes them again
// when they are deleted or replaced in WAY.
//
//   nutrition-log  -> .nutrition.writeonly
//   weight         -> .health_metrics_and_measurements.writeonly
//
// Every function is best-effort: a Google failure must never stop a log from
// being saved in WAY, so these return a result object instead of throwing.

import { getValidAccessToken, NUTRITION_WRITE_SCOPE, METRICS_WRITE_SCOPE } from '@/lib/googleHealth';
import { APP_TIME_ZONE, todayLocalDate } from '@/lib/dateUtils';

const API = 'https://health.googleapis.com/v4';

// WAY meal category -> Google Health MealType.
// The order in MEAL_CATEGORIES is breakfast, mid-day snack, lunch, evening
// snack, dinner, so those snacks line up with Google's morning / afternoon.
const MEAL_TYPE = {
  breakfast: 'BREAKFAST',
  mid_day_snack: 'BEFORE_LUNCH', // "morning snack"
  lunch: 'LUNCH',
  evening_snack: 'BEFORE_DINNER', // "afternoon snack"
  dinner: 'DINNER',
  beverage: 'ANYTIME',
  other: 'ANYTIME',
};

// Foods only carry a date, so give each meal a sensible time of day.
const MEAL_TIME = {
  breakfast: [8, 0],
  mid_day_snack: [11, 0],
  lunch: [13, 0],
  evening_snack: [17, 0],
  dinner: [20, 0],
  beverage: [15, 0],
  other: [16, 0],
};

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/* ---------- time helpers (app timezone, not the server's) ---------- */

function offsetSeconds(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - Math.floor(ts / 1000) * 1000) / 1000);
}

/** Wall-clock time on `dateStr` in the app timezone -> epoch ms. */
function zonedTimestamp(dateStr, hour, minute) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  let ts = naive - offsetSeconds(naive) * 1000;
  ts = naive - offsetSeconds(ts) * 1000; // second pass settles DST edges
  return ts;
}

function stamp(ts, utc = false) {
  // Plain UTC form (no offset fields) - the shape used in Google's own examples.
  if (utc) return { time: new Date(ts).toISOString().slice(0, 19) + 'Z', offset: undefined };
  const off = offsetSeconds(ts);
  const local = new Date(ts + off * 1000).toISOString().slice(0, 19);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return { time: `${local}${sign}${hh}:${mm}`, offset: `${off}s` };
}

/* ---------- HTTP ---------- */

async function ghFetch(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${res.status}: ${data.error?.message || 'Google Health request failed'}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Stored names look like users/<id>/dataTypes/<type>/dataPoints/<id>; the
// API docs use users/me/... for batchDelete.
const toMeName = (name) => name.replace(/^users\/[^/]+\//, 'users/me/');

async function createPoint(token, dataType, dataPoint) {
  const op = await ghFetch(token, `users/me/dataTypes/${dataType}/dataPoints`, {
    method: 'POST',
    body: dataPoint,
  });
  const name = op?.response?.name ?? op?.name ?? null;
  return name;
}

async function deletePoints(token, dataType, names) {
  const clean = [...new Set(names.filter(Boolean).map(toMeName))];
  for (let i = 0; i < clean.length; i += 20) {
    await ghFetch(token, `users/me/dataTypes/${dataType}/dataPoints:batchDelete`, {
      method: 'POST',
      body: { names: clean.slice(i, i + 20) },
    });
  }
}

/* ---------- connection / permission check ---------- */

async function getContext(supabase, userId, scope) {
  const { data: conn } = await supabase
    .from('google_health_connections')
    .select('scopes, sync_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (!conn) return { skipped: 'not_connected' };
  if (conn.sync_enabled === false) return { skipped: 'sync_off' };
  if (!(conn.scopes ?? '').includes(scope)) return { skipped: 'missing_scope' };

  try {
    const token = await getValidAccessToken(supabase, userId);
    if (!token) return { skipped: 'not_connected' };
    return { token };
  } catch (err) {
    return { skipped: err.reauthRequired ? 'reauth_required' : 'error', error: err.message };
  }
}

/* ---------- food ---------- */

function buildNutritionLog(log, utc = false) {
  const food = log.foods;
  const ratio = Number(log.quantity_g) / 100;
  const [hh, mm] = MEAL_TIME[log.meal_type] ?? MEAL_TIME.other;

  // Don't put a meal in the future (e.g. logging lunch at 9am): clamp to now.
  const now = Date.now();
  let start = zonedTimestamp(log.logged_at, hh, mm);
  let end = start + 15 * 60 * 1000;
  if (end > now) {
    end = now - 1000;
    start = end - 15 * 60 * 1000;
  }
  const s = stamp(start, utc);
  const e = stamp(end, utc);

  return {
    nutritionLog: {
      interval: {
        startTime: s.time,
        ...(s.offset ? { startUtcOffset: s.offset } : {}),
        endTime: e.time,
        ...(e.offset ? { endUtcOffset: e.offset } : {}),
      },
      foodDisplayName: `${food.name} (${Math.round(log.quantity_g)}g)`.slice(0, 120),
      mealType: MEAL_TYPE[log.meal_type] ?? 'ANYTIME',
      energy: { kcal: r1(food.calories_kcal * ratio) },
      totalCarbohydrate: { grams: r1(food.carbs_g * ratio) },
      totalFat: { grams: r1(food.fat_g * ratio) },
      nutrients: [{ nutrient: 'PROTEIN', quantity: { grams: r1(food.protein_g * ratio) } }],
      serving: { amount: 1 },
    },
  };
}

/**
 * Create (or replace) the Google Health nutrition logs for these food_logs.
 * Logs created from "anonymous food" can't be edited in Google Health, so an
 * edited entry is deleted there and recreated.
 */
export async function syncFoodLogs(supabase, userId, logIds) {
  if (!logIds?.length) return { ok: true, synced: 0 };
  const ctx = await getContext(supabase, userId, NUTRITION_WRITE_SCOPE);
  if (!ctx.token) return { ok: false, ...ctx };

  const FOOD_COLS = 'id, quantity_g, meal_type, logged_at, foods(name, calories_kcal, protein_g, carbs_g, fat_g)';
  let { data: logs, error } = await supabase
    .from('food_logs')
    .select(`${FOOD_COLS}, google_health_point_id`)
    .eq('user_id', userId)
    .in('id', logIds);
  if (error) {
    // google_health_point_id column missing? still sync, just can't track/replace points.
    ({ data: logs, error } = await supabase
      .from('food_logs')
      .select(FOOD_COLS)
      .eq('user_id', userId)
      .in('id', logIds));
  }
  if (error) return { ok: false, skipped: 'error', error: error.message };

  const usable = (logs ?? []).filter((l) => l.foods);

  // Say why nothing is sent instead of reporting a quiet "0 synced".
  if (usable.length === 0) {
    return {
      ok: false,
      synced: 0,
      error: `No meals to send (received ${logIds.length} ids, found ${(logs ?? []).length} matching logs, ${usable.length} with food details).`,
    };
  }

  try {
    await deletePoints(
      ctx.token,
      'nutrition-log',
      usable.map((l) => l.google_health_point_id)
    );
  } catch {
    // Old point already gone / not deletable: carry on and create the new one.
  }

  let synced = 0;
  const failures = [];
  for (let i = 0; i < usable.length; i += 4) {
    await Promise.all(
      usable.slice(i, i + 4).map(async (log) => {
        try {
          let name;
          try {
            name = await createPoint(ctx.token, 'nutrition-log', buildNutritionLog(log));
          } catch (err) {
            if (err.status !== 400) throw err;
            name = await createPoint(ctx.token, 'nutrition-log', buildNutritionLog(log, true));
          }
          await supabase.from('food_logs').update({ google_health_point_id: name }).eq('id', log.id);
          synced += 1;
        } catch (err) {
          failures.push(err.message);
        }
      })
    );
  }
  return { ok: failures.length === 0, synced, failures };
}

/** Remove the Google Health copies of these food_logs (call BEFORE deleting the rows). */
export async function deleteFoodLogPoints(supabase, userId, logIds) {
  if (!logIds?.length) return { ok: true, deleted: 0 };
  const ctx = await getContext(supabase, userId, NUTRITION_WRITE_SCOPE);
  if (!ctx.token) return { ok: false, ...ctx };

  const { data: logs } = await supabase
    .from('food_logs')
    .select('google_health_point_id')
    .eq('user_id', userId)
    .in('id', logIds);

  const names = (logs ?? []).map((l) => l.google_health_point_id).filter(Boolean);
  if (names.length === 0) return { ok: true, deleted: 0 };
  try {
    await deletePoints(ctx.token, 'nutrition-log', names);
    return { ok: true, deleted: names.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------- weight ---------- */

/** Push the weigh-in for `date` (replacing the previous copy for that day). */
export async function syncWeightLog(supabase, userId, date) {
  const ctx = await getContext(supabase, userId, METRICS_WRITE_SCOPE);
  if (!ctx.token) return { ok: false, ...ctx };

  let { data: row, error } = await supabase
    .from('weight_logs')
    .select('weight_kg, logged_at, google_health_point_id')
    .eq('user_id', userId)
    .eq('logged_at', date)
    .maybeSingle();
  if (error) {
    ({ data: row, error } = await supabase
      .from('weight_logs')
      .select('weight_kg, logged_at')
      .eq('user_id', userId)
      .eq('logged_at', date)
      .maybeSingle());
  }
  if (error || !row) return { ok: false, skipped: 'error', error: error?.message ?? 'No weigh-in for that date' };

  try {
    await deletePoints(ctx.token, 'weight', [row.google_health_point_id]);
  } catch {
    // ignore — see syncFoodLogs
  }

  // Today: the moment of logging. Earlier days: early morning, when most
  // people weigh themselves.
  const ts =
    date === todayLocalDate() ? Date.now() - 1000 : zonedTimestamp(date, 7, 0);
  const weightPoint = (utc) => {
    const st = stamp(ts, utc);
    return {
      weight: {
        sampleTime: { physicalTime: st.time, ...(st.offset ? { utcOffset: st.offset } : {}) },
        weightGrams: Math.round(Number(row.weight_kg) * 1000),
      },
    };
  };

  try {
    let name;
    try {
      name = await createPoint(ctx.token, 'weight', weightPoint(false));
    } catch (err) {
      if (err.status !== 400) throw err;
      name = await createPoint(ctx.token, 'weight', weightPoint(true));
    }
    await supabase
      .from('weight_logs')
      .update({ google_health_point_id: name })
      .eq('user_id', userId)
      .eq('logged_at', date);
    return { ok: true, synced: 1 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------- manual "Sync now" (Settings) ---------- */

/** Push today's food logs and the latest weigh-in, and report exactly what Google said. */
export async function backfillGoogleHealth(supabase, userId) {
  const report = { food: null, weight: null };

  const { data: foodRows, error: foodErr } = await supabase
    .from('food_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('logged_at', todayLocalDate())
    .limit(50);
  if (foodErr) report.food = { ok: false, error: foodErr.message };
  else if (!foodRows?.length) report.food = { ok: true, synced: 0, note: 'No meals logged today' };
  else report.food = await syncFoodLogs(supabase, userId, foodRows.map((r) => r.id));

  const { data: w } = await supabase
    .from('weight_logs')
    .select('logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  report.weight = w?.logged_at
    ? await syncWeightLog(supabase, userId, w.logged_at)
    : { ok: true, synced: 0, note: 'No weigh-ins yet' };

  return report;
}