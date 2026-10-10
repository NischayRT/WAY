// lib/googleHealth.js
//
// Server-only helpers for the Google Health API OAuth flow and data
// fetching. Never import this from a Client Component — it reads
// GOOGLE_HEALTH_CLIENT_SECRET, which must stay server-side only.

import { todayLocalDate } from '@/lib/dateUtils';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const ACTIVITY_SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
// Write scopes let WAY push food logs (macros) and weigh-ins into Google Health.
export const NUTRITION_WRITE_SCOPE = 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly';
export const METRICS_WRITE_SCOPE = 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.writeonly';
// Read scope for vitals (resting heart rate, SpO2, VO2 max). Users who
// connected before this was added must reconnect once to grant it.
export const METRICS_READ_SCOPE = 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';
export const ALL_SCOPES = [ACTIVITY_SCOPE, METRICS_READ_SCOPE, NUTRITION_WRITE_SCOPE, METRICS_WRITE_SCOPE];

// Optional scopes, requested only when the user turns on a tile that needs
// them (incremental authorisation: include_granted_scopes keeps the rest).
export const OPTIONAL_SCOPES = {
  sleep: 'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  irn: 'https://www.googleapis.com/auth/googlehealth.irn.readonly', // irregular rhythm notifications
};

export function buildAuthUrl(state, extra = []) {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_HEALTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true', // keep read access if a reconnect only adds the write scopes
    prompt: 'consent', // forces a refresh_token on every authorization, not just the first-ever consent
    scope: [...ALL_SCOPES, ...extra.map((k) => OPTIONAL_SCOPES[k]).filter(Boolean)].join(' '),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_HEALTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange code for tokens');
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_HEALTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant means the refresh token itself is dead — revoked by
    // the user, or expired from 6 months of non-use (per Google's own
    // docs). No amount of retrying fixes this; the user has to
    // reconnect. Anything else is a more ordinary/transient failure.
    const err = new Error(data.error_description || data.error || 'Failed to refresh access token');
    if (data.error === 'invalid_grant') err.reauthRequired = true;
    throw err;
  }
  return data; // { access_token, expires_in, ... } — refresh_token usually NOT re-issued here
}

/**
 * Returns a valid (non-expired) access token for this user, refreshing
 * and persisting a new one first if the stored one has expired. Returns
 * null if the user has never connected.
 */
export async function getValidAccessToken(supabase, userId) {
  const { data: connection } = await supabase
    .from('google_health_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!connection) return null;

  const isExpired = new Date(connection.expires_at).getTime() <= Date.now() + 60_000; // 60s buffer
  if (!isExpired) return connection.access_token;

  try {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabase
      .from('google_health_connections')
      .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
      .eq('user_id', userId);

    return refreshed.access_token;
  } catch (err) {
    if (err.reauthRequired) {
      // The connection is dead (revoked, or 6 months unused) — remove
      // the stale row so Settings correctly shows "Connect" again
      // instead of a "Connected" state that secretly doesn't work.
      await supabase.from('google_health_connections').delete().eq('user_id', userId);
    }
    throw err;
  }
}

/**
 * Steps, distance (km) and calories burned (kcal) for one calendar day
 * (YYYY-MM-DD, defaults to today in the app timezone).
 *
 * Uses the same dailyRollUp path as the Progress page. The earlier version
 * listed raw data points and guessed at their field names / UTC date prefix,
 * which returned 0 for distance and burn (and mis-bucketed days for IST).
 * dailyRollUp is Google's recommended way to total a civil day.
 */
export async function fetchDailyMetrics(accessToken, targetDateStr = null) {
  const dateStr = targetDateStr || todayLocalDate();
  const [day] = await fetchDailyHistory(accessToken, dateStr, dateStr);
  return {
    steps: day?.steps ?? 0,
    distanceKm: day?.distanceKm ?? 0,
    caloriesBurned: day?.caloriesBurned ?? 0,
    activeCalories: day?.activeCalories ?? 0,
    totalCalories: day?.totalCalories ?? null,
  };
}

/**
 * Legacy wrapper: Fetches today's total step count.
 */
export async function fetchTodaySteps(accessToken) {
  const metrics = await fetchDailyMetrics(accessToken);
  return metrics.steps;
}

/* ------------------------------------------------------------------ */
/* Daily history for the Progress page (steps / distance / burn)       */
/* ------------------------------------------------------------------ */

const HEALTH_BASE = 'https://health.googleapis.com/v4/users/me/dataTypes';

function shiftDate(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().split('T')[0];
}

function civil(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { date: { year, month, day }, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } };
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * One dailyRollUp per chunk (Google caps a request at 90 days for steps,
 * distance and active energy, 14 days for total calories). Returns a Map of
 * YYYY-MM-DD -> number for the days Google returned.
 */
async function dailyRollupRange(accessToken, dataType, fromStr, toStr, maxDays, pick) {
  const out = new Map();
  let cursor = fromStr;
  while (cursor <= toStr) {
    const chunkEnd = shiftDate(cursor, maxDays - 1) < toStr ? shiftDate(cursor, maxDays - 1) : toStr;
    const res = await fetch(`${HEALTH_BASE}/${dataType}/dataPoints:dailyRollUp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Closed-open civil range, so the end is midnight after the last day.
      body: JSON.stringify({
        range: { start: civil(cursor), end: civil(shiftDate(chunkEnd, 1)) },
        windowSizeDays: 1,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error?.message || `Google Health responded ${res.status}`);
      err.status = res.status;
      throw err;
    }
    for (const point of data.rollupDataPoints ?? []) {
      const d = point.civilStartTime?.date;
      if (!d) continue;
      const key = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
      const value = pick(point);
      if (Number.isFinite(value)) out.set(key, value);
    }
    cursor = shiftDate(chunkEnd, 1);
  }
  return out;
}

const kcalOf = (point, key) => {
  const direct = point[key]?.kcalSum;
  if (direct != null) return Number(direct);
  // Be tolerant of the rollup field name: take the first object carrying kcalSum.
  for (const v of Object.values(point)) {
    if (v && typeof v === 'object' && v.kcalSum != null) return Number(v.kcalSum);
  }
  return NaN;
};

/**
 * Per-day steps, distance (km) and calories between two dates, inclusive.
 * Days Google has nothing for come back as null.
 *
 * Calories come back three ways:
 *   totalCalories   resting metabolism + activity: the number Google's own
 *                   app headlines as calories burned
 *   activeCalories  energy from movement only: what a burn GOAL (e.g. 400
 *                   kcal) is measured against
 *   caloriesBurned  total when Google has it, otherwise active
 * The old code returned ACTIVE calories whenever any day in the range had
 * them and only fell back to total otherwise, so the home tile showed a
 * different (much smaller) number than Google's app, and could even switch
 * meaning between date ranges.
 */
export async function fetchDailyHistory(accessToken, fromStr, toStr) {
  const [steps, distance, active, total] = await Promise.all([
    dailyRollupRange(accessToken, 'steps', fromStr, toStr, 90, (p) => Number(p.steps?.countSum)),
    dailyRollupRange(accessToken, 'distance', fromStr, toStr, 90, (p) => {
      const mm = Number(p.distance?.millimetersSum);
      return Number.isFinite(mm) ? mm / 1_000_000 : NaN;
    }).catch(() => new Map()),
    dailyRollupRange(accessToken, 'active-energy-burned', fromStr, toStr, 90, (p) =>
      kcalOf(p, 'activeEnergyBurned')
    ).catch(() => new Map()),
    // Google caps total-calories roll-ups at 14 days per request (chunked).
    dailyRollupRange(accessToken, 'total-calories', fromStr, toStr, 14, (p) =>
      kcalOf(p, 'totalCalories')
    ).catch(() => new Map()),
  ]);

  const days = [];
  for (let d = fromStr; d <= toStr; d = shiftDate(d, 1)) {
    days.push({
      date: d,
      steps: steps.has(d) ? Math.round(steps.get(d)) : null,
      distanceKm: distance.has(d) ? Math.round(distance.get(d) * 100) / 100 : null,
      totalCalories: total.has(d) ? Math.round(total.get(d)) : null,
      activeCalories: active.has(d) ? Math.round(active.get(d)) : null,
      caloriesBurned: total.has(d) ? Math.round(total.get(d)) : active.has(d) ? Math.round(active.get(d)) : null,
    });
  }
  return days;
}

/**
 * Revoke a Google OAuth token (pass the refresh token to revoke the whole grant).
 * Best effort: a failure must never block disconnecting or deleting an account.
 */
export async function revokeGoogleToken(token) {
  if (!token) return false;
  try {
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Vitals: resting heart rate, SpO2, VO2 max                           */
/* ------------------------------------------------------------------ */
//
// All three are DAILY SUMMARY data types. The Google Health API has no live
// stream: wearables sync periodically and these summaries are calculated
// from the day's (or night's) measurements, so today's value often isn't
// there until after sleep. We read the last few days and return the most
// recent value on or before the requested date, with the date it belongs to.
//
// Needs the health_metrics_and_measurements.readonly scope.

const VITALS_LOOKBACK_DAYS = 7;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const dateStrOf = (d) => (d && d.year ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : null);

/** Daily summary points for a data type between two dates (inclusive). */
async function listDaily(accessToken, dataType, field, fromStr, toStr) {
  const filter = `${field}.date >= "${fromStr}" AND ${field}.date < "${shiftDate(toStr, 1)}"`;
  const url = `${HEALTH_BASE}/${dataType}/dataPoints?pageSize=50&filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, cache: 'no-store' });
  if (res.status === 403) {
    const err = new Error('Missing permission for health metrics');
    err.permissionDenied = true;
    throw err;
  }
  if (!res.ok) throw new Error(`${dataType} list failed: ${res.status}`);
  const data = await res.json();
  return (data.dataPoints || []).map((p) => p[field]).filter(Boolean);
}

/** Most recent point (by its date) on or before toStr. */
function latest(points) {
  return points
    .map((p) => ({ p, date: dateStrOf(p.date) }))
    .filter((x) => x.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

/** First numeric field whose name contains `hint` (field names vary between summary types). */
function numberField(obj, hint) {
  const key = Object.keys(obj || {}).find((k) => k !== 'date' && k.toLowerCase().includes(hint) && toNum(obj[k]) !== null);
  return key ? toNum(obj[key]) : null;
}

/**
 * @returns {{ restingHeartRate: {bpm, date}|null, spo2: {percent, low, high, date}|null,
 *             vo2Max: {value, level, date}|null }}
 * Throws with err.permissionDenied when the user hasn't granted the vitals scope.
 */
export async function fetchVitals(accessToken, targetDateStr = null) {
  const toStr = targetDateStr || todayLocalDate();
  const fromStr = shiftDate(toStr, -(VITALS_LOOKBACK_DAYS - 1));

  const [rhr, spo2, vo2] = await Promise.allSettled([
    listDaily(accessToken, 'daily-resting-heart-rate', 'dailyRestingHeartRate', fromStr, toStr),
    listDaily(accessToken, 'daily-oxygen-saturation', 'dailyOxygenSaturation', fromStr, toStr),
    listDaily(accessToken, 'daily-vo2-max', 'dailyVo2Max', fromStr, toStr),
  ]);

  // If every call was refused for permission, surface that to the caller.
  const results = [rhr, spo2, vo2];
  if (results.every((r) => r.status === 'rejected' && r.reason?.permissionDenied)) {
    throw results[0].reason;
  }
  const ok = (r) => (r.status === 'fulfilled' ? r.value : []);

  const r = latest(ok(rhr));
  const s = latest(ok(spo2));
  const v = latest(ok(vo2));

  return {
    restingHeartRate: r && toNum(r.p.beatsPerMinute) ? { bpm: Math.round(toNum(r.p.beatsPerMinute)), date: r.date } : null,
    spo2: s && numberField(s.p, 'average') !== null
      ? {
          percent: Math.round(numberField(s.p, 'average') * 10) / 10,
          low: numberField(s.p, 'lower'),
          high: numberField(s.p, 'upper'),
          date: s.date,
        }
      : null,
    vo2Max: v && numberField(v.p, 'vo2') !== null
      ? { value: Math.round(numberField(v.p, 'vo2') * 10) / 10, level: v.p.cardioFitnessLevel || null, date: v.date }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Extra home tiles: heart, floors, sleep, glucose                     */
/* ------------------------------------------------------------------ */
//
// The roll-up value messages (HeartRateRollupValue, FloorsRollupValue) are
// read by field-name pattern (min / max / avg, count) rather than hard-coded
// names, so a field rename upstream degrades to "no data" instead of an error.

const isPerm = (res) => res.status === 403;

function statsOf(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const n = toNum(v);
    if (n === null) continue;
    const key = k.toLowerCase();
    if (key.includes('min')) out.min = n;
    else if (key.includes('max')) out.max = n;
    else if (key.includes('avg') || key.includes('average') || key.includes('mean')) out.avg = n;
    else if (key.includes('count') || key.includes('sum')) out.sum = n;
  }
  return out;
}

async function rollupOneDay(accessToken, dataType, dateStr) {
  const res = await fetch(`${HEALTH_BASE}/${dataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ range: { start: civil(dateStr), end: civil(shiftDate(dateStr, 1)) }, windowSizeDays: 1 }),
    cache: 'no-store',
  });
  if (isPerm(res)) {
    const err = new Error('permission');
    err.permissionDenied = true;
    throw err;
  }
  if (!res.ok) throw new Error(`${dataType} rollup ${res.status}`);
  const data = await res.json().catch(() => ({}));
  const point = (data.rollupDataPoints || [])[0];
  if (!point) return null;
  // the value object is the one non-time field
  const key = Object.keys(point).find((k) => !/time/i.test(k) && point[k] && typeof point[k] === 'object');
  return key ? point[key] : null;
}

async function listPoints(accessToken, dataType, filter, pageSize = 100) {
  const url = `${HEALTH_BASE}/${dataType}/dataPoints?pageSize=${pageSize}&filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, cache: 'no-store' });
  if (isPerm(res)) {
    const err = new Error('permission');
    err.permissionDenied = true;
    throw err;
  }
  if (!res.ok) throw new Error(`${dataType} list ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return data.dataPoints || [];
}

/** Wrap a fetcher so one tile's failure (or missing permission) never breaks the others. */
async function settle(fn) {
  try {
    return { data: await fn() };
  } catch (err) {
    if (err.permissionDenied) return { needsPermission: true };
    console.error('[google-health tile]', err?.message);
    return { error: true };
  }
}

const rethrowPerm = (fallback) => (e) => {
  if (e.permissionDenied) throw e;
  return fallback;
};

/** Resting HR (latest within 7 days) + today's high/low/average + irregular rhythm notifications (7 days). */
async function heartTile(accessToken, dateStr) {
  const from = shiftDate(dateStr, -6);
  const [rhr, day, irn] = await Promise.all([
    listDaily(accessToken, 'daily-resting-heart-rate', 'dailyRestingHeartRate', from, dateStr).catch(rethrowPerm([])),
    rollupOneDay(accessToken, 'heart-rate', dateStr).catch(rethrowPerm(null)),
    settle(() =>
      listPoints(
        accessToken,
        'irregular-rhythm-notification',
        `irregularRhythmNotification.interval.civil_start_time >= "${from}" AND irregularRhythmNotification.interval.civil_start_time < "${shiftDate(dateStr, 1)}"`,
        10
      )
    ),
  ]);
  const r = latest(rhr);
  const st = statsOf(day);
  const notes = (irn.data || [])
    .map((p) => dateStrOf(p.irregularRhythmNotification?.interval?.civilStartTime?.date))
    .filter(Boolean)
    .sort()
    .reverse();
  return {
    restingBpm: r && toNum(r.p.beatsPerMinute) ? Math.round(toNum(r.p.beatsPerMinute)) : null,
    restingDate: r?.date ?? null,
    todayMin: st.min != null ? Math.round(st.min) : null,
    todayMax: st.max != null ? Math.round(st.max) : null,
    todayAvg: st.avg != null ? Math.round(st.avg) : null,
    irregular: irn.needsPermission ? { needsPermission: true } : { count: notes.length, latestDate: notes[0] ?? null },
  };
}

async function oxygenFitnessTile(accessToken, dateStr) {
  const v = await fetchVitals(accessToken, dateStr);
  return { spo2: v.spo2, vo2Max: v.vo2Max };
}

async function floorsTile(accessToken, dateStr) {
  const value = await rollupOneDay(accessToken, 'floors', dateStr);
  const st = statsOf(value);
  return { floors: Math.round(st.sum ?? 0) };
}

/** Main sleep that ENDED on dateStr (i.e. last night, for today). */
async function sleepTile(accessToken, dateStr) {
  const points = await listPoints(
    accessToken,
    'sleep',
    `sleep.interval.civil_end_time >= "${dateStr}" AND sleep.interval.civil_end_time < "${shiftDate(dateStr, 1)}"`,
    25
  );
  const sessions = points.map((p) => p.sleep).filter(Boolean);
  if (!sessions.length) return { minutesAsleep: null };
  const main =
    sessions.find((x) => x.metadata?.mainSleep) ||
    sessions.sort((a, b) => (toNum(b.summary?.minutesAsleep) || 0) - (toNum(a.summary?.minutesAsleep) || 0))[0];
  const stages = {};
  for (const st of main.summary?.stagesSummary || []) stages[st.type] = toNum(st.minutes) || 0;
  const t = (x) => (x?.time ? `${pad(x.time.hours ?? 0)}:${pad(x.time.minutes ?? 0)}` : null);
  return {
    minutesAsleep: toNum(main.summary?.minutesAsleep),
    minutesAwake: toNum(main.summary?.minutesAwake),
    stages, // { DEEP, LIGHT, REM, AWAKE } minutes (stages sleep) or { ASLEEP, RESTLESS, AWAKE } (classic)
    bedtime: t(main.interval?.civilStartTime),
    wake: t(main.interval?.civilEndTime),
  };
}

/** Blood glucose readings logged on dateStr, in mg/dL (the unit used in India). */
async function glucoseTile(accessToken, dateStr) {
  const points = await listPoints(
    accessToken,
    'blood-glucose',
    `bloodGlucose.sample_time.civil_time >= "${dateStr}" AND bloodGlucose.sample_time.civil_time < "${shiftDate(dateStr, 1)}"`,
    200
  );
  const readings = points
    .map((p) => p.bloodGlucose)
    .filter(Boolean)
    .map((g) => {
      const entry = Object.entries(g).find(
        ([k, v]) => /mill|mg|mol|value|level|concentration/i.test(k) && toNum(v?.value ?? v) !== null
      );
      if (!entry) return null;
      const [k, raw] = entry;
      const n = toNum(raw?.value ?? raw);
      const mgdl = /mol/i.test(k) ? n * 18.0182 : n; // mmol/L -> mg/dL
      return { mgdl: Math.round(mgdl), time: g.sampleTime?.physicalTime ?? '' };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  if (!readings.length) return { latest: null };
  const vals = readings.map((r) => r.mgdl);
  return { latest: readings[readings.length - 1].mgdl, min: Math.min(...vals), max: Math.max(...vals), count: readings.length };
}

export const EXTRA_TILE_FETCHERS = {
  heart: heartTile,
  oxygen: oxygenFitnessTile,
  floors: floorsTile,
  sleep: sleepTile,
  glucose: glucoseTile,
};

/** { [tileKey]: { data } | { needsPermission: true } | { error: true } } */
export async function fetchExtraTiles(accessToken, dateStr, keys) {
  const wanted = keys.filter((k) => EXTRA_TILE_FETCHERS[k]);
  const results = await Promise.all(wanted.map((k) => settle(() => EXTRA_TILE_FETCHERS[k](accessToken, dateStr))));
  return Object.fromEntries(wanted.map((k, i) => [k, results[i]]));
}

/* ------------------------------------------------------------------ */
/* Range history for the Activity page's optional charts               */
/* ------------------------------------------------------------------ */

/** All pages of a list query (capped), for ranges longer than one page. */
async function listAll(accessToken, dataType, filter, pageSize, maxPages = 20) {
  const out = [];
  let token = '';
  for (let i = 0; i < maxPages; i += 1) {
    const q = new URLSearchParams({ pageSize: String(pageSize), filter });
    if (token) q.set('pageToken', token);
    const res = await fetch(`${HEALTH_BASE}/${dataType}/dataPoints?${q.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (isPerm(res)) {
      const err = new Error('permission');
      err.permissionDenied = true;
      throw err;
    }
    if (!res.ok) throw new Error(`${dataType} list ${res.status}`);
    const data = await res.json().catch(() => ({}));
    out.push(...(data.dataPoints || []));
    token = data.nextPageToken;
    if (!token) break;
  }
  return out;
}

const dailyFilter = (field, from, to) => `${field}.date >= "${from}" AND ${field}.date < "${shiftDate(to, 1)}"`;

/** Per-day roll-up value OBJECTS (not just one number), chunked by maxDays. */
async function dailyRollupObjects(accessToken, dataType, fromStr, toStr, maxDays) {
  const out = new Map();
  let cursor = fromStr;
  while (cursor <= toStr) {
    const chunkEnd = shiftDate(cursor, maxDays - 1) < toStr ? shiftDate(cursor, maxDays - 1) : toStr;
    const res = await fetch(`${HEALTH_BASE}/${dataType}/dataPoints:dailyRollUp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ range: { start: civil(cursor), end: civil(shiftDate(chunkEnd, 1)) }, windowSizeDays: 1 }),
      cache: 'no-store',
    });
    if (isPerm(res)) {
      const err = new Error('permission');
      err.permissionDenied = true;
      throw err;
    }
    if (!res.ok) throw new Error(`${dataType} rollup ${res.status}`);
    const data = await res.json().catch(() => ({}));
    for (const point of data.rollupDataPoints ?? []) {
      const d = dateStrOf(point.civilStartTime?.date);
      const key = Object.keys(point).find((k) => !/time/i.test(k) && point[k] && typeof point[k] === 'object');
      if (d && key) out.set(d, point[key]);
    }
    cursor = shiftDate(chunkEnd, 1);
  }
  return out;
}

// Heart-rate roll-ups are capped at 14 days per request; beyond this span
// only the daily resting heart rate is charted (keeps long ranges fast).
const HEART_RANGE_MAX_DAYS = 92;

const HISTORY_FETCHERS = {
  async heart(token, from, to) {
    const span = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
    const [rhr, day] = await Promise.all([
      listAll(token, 'daily-resting-heart-rate', dailyFilter('dailyRestingHeartRate', from, to), 1000),
      span <= HEART_RANGE_MAX_DAYS ? dailyRollupObjects(token, 'heart-rate', from, to, 14).catch(rethrowPerm(new Map())) : new Map(),
    ]);
    const resting = new Map();
    for (const p of rhr) {
      const v = p.dailyRestingHeartRate;
      const d = dateStrOf(v?.date);
      if (d && toNum(v.beatsPerMinute)) resting.set(d, Math.round(toNum(v.beatsPerMinute)));
    }
    return { resting, day: new Map([...day].map(([d, o]) => [d, statsOf(o)])) };
  },
  async oxygen(token, from, to) {
    const [s, v] = await Promise.all([
      listAll(token, 'daily-oxygen-saturation', dailyFilter('dailyOxygenSaturation', from, to), 1000),
      listAll(token, 'daily-vo2-max', dailyFilter('dailyVo2Max', from, to), 1000).catch(rethrowPerm([])),
    ]);
    const spo2 = new Map();
    for (const p of s) {
      const o = p.dailyOxygenSaturation;
      const d = dateStrOf(o?.date);
      const n = numberField(o, 'average');
      if (d && n !== null) spo2.set(d, Math.round(n * 10) / 10);
    }
    const vo2 = new Map();
    for (const p of v) {
      const o = p.dailyVo2Max;
      const d = dateStrOf(o?.date);
      const n = numberField(o, 'vo2');
      if (d && n !== null) vo2.set(d, Math.round(n * 10) / 10);
    }
    return { spo2, vo2 };
  },
  async floors(token, from, to) {
    const m = await dailyRollupObjects(token, 'floors', from, to, 90);
    return { floors: new Map([...m].map(([d, o]) => [d, Math.round(statsOf(o).sum ?? 0)])) };
  },
  async sleep(token, from, to) {
    const pts = await listAll(
      token,
      'sleep',
      `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${shiftDate(to, 1)}"`,
      25,
      20
    );
    // One value per night, keyed by the date the sleep ENDED; the main sleep wins.
    const byDay = new Map();
    for (const p of pts) {
      const sl = p.sleep;
      const d = dateStrOf(sl?.interval?.civilEndTime?.date);
      const mins = toNum(sl?.summary?.minutesAsleep);
      if (!d || mins === null) continue;
      const prev = byDay.get(d);
      if (!prev || sl.metadata?.mainSleep || mins > prev.mins) byDay.set(d, { mins, main: !!sl.metadata?.mainSleep });
    }
    return { sleepHours: new Map([...byDay].map(([d, x]) => [d, Math.round((x.mins / 60) * 10) / 10])) };
  },
  async glucose(token, from, to) {
    const pts = await listAll(
      token,
      'blood-glucose',
      `bloodGlucose.sample_time.civil_time >= "${from}" AND bloodGlucose.sample_time.civil_time < "${shiftDate(to, 1)}"`,
      1000,
      5
    );
    const perDay = new Map();
    for (const p of pts) {
      const g = p.bloodGlucose;
      if (!g) continue;
      const entry = Object.entries(g).find(([k, v]) => /mill|mg|mol|value|level|concentration/i.test(k) && toNum(v?.value ?? v) !== null);
      const d = dateStrOf(g.sampleTime?.civilTime?.date);
      if (!entry || !d) continue;
      const n = toNum(entry[1]?.value ?? entry[1]);
      const mgdl = /mol/i.test(entry[0]) ? n * 18.0182 : n;
      if (!perDay.has(d)) perDay.set(d, []);
      perDay.get(d).push(mgdl);
    }
    const avg = new Map();
    for (const [d, arr] of perDay) avg.set(d, Math.round(arr.reduce((a, b) => a + b, 0) / arr.length));
    return { glucoseAvg: avg };
  },
};

/**
 * Optional per-day series for the Activity page. Returns
 * { [key]: { data: { series: { name: [{date, value}] } } } | { needsPermission } | { error } }
 * where every series has one entry per day in the range (null = no data).
 */
export async function fetchExtraHistory(accessToken, fromStr, toStr, keys) {
  const dates = [];
  for (let d = fromStr; d <= toStr; d = shiftDate(d, 1)) dates.push(d);
  const toSeries = (map) => dates.map((date) => ({ date, value: map.has(date) ? map.get(date) : null }));

  const wanted = keys.filter((k) => HISTORY_FETCHERS[k]);
  const results = await Promise.all(
    wanted.map((k) =>
      settle(async () => {
        const maps = await HISTORY_FETCHERS[k](accessToken, fromStr, toStr);
        const series = {};
        for (const [name, m] of Object.entries(maps)) {
          if (name === 'day') {
            series.low = dates.map((date) => ({ date, value: m.get(date)?.min ?? null }));
            series.high = dates.map((date) => ({ date, value: m.get(date)?.max ?? null }));
          } else {
            series[name] = toSeries(m);
          }
        }
        return { series };
      })
    )
  );
  return Object.fromEntries(wanted.map((k, i) => [k, results[i]]));
}
