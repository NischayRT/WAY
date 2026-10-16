// lib/googleHealth.js
//
// Server-only helpers for the Google Health API OAuth flow and data
// fetching. Never import this from a Client Component — it reads
// GOOGLE_HEALTH_CLIENT_SECRET, which must stay server-side only.

import { todayLocalDate } from '@/lib/dateUtils';
import { encryptToken, decryptToken, isEncrypted } from '@/lib/tokenCrypto';

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

  // Tokens are stored encrypted (lib/tokenCrypto.js). Rows written before
  // encryption was turned on are plaintext: encrypt them now, once.
  let accessToken;
  let refreshToken;
  try {
    accessToken = decryptToken(connection.access_token);
    refreshToken = decryptToken(connection.refresh_token);
  } catch (e) {
    // Key missing or changed: the stored tokens are unusable. Drop the row so
    // the app shows "Connect Google Health" again instead of failing forever.
    console.error('[google-health] could not decrypt stored tokens:', e.message);
    await supabase.from('google_health_connections').delete().eq('user_id', userId);
    const err = new Error('Stored Google Health tokens could not be read; please reconnect.');
    err.reauthRequired = true;
    throw err;
  }
  if (!isEncrypted(connection.refresh_token) && isEncrypted(encryptToken('probe'))) {
    await supabase
      .from('google_health_connections')
      .update({ access_token: encryptToken(accessToken), refresh_token: encryptToken(refreshToken) })
      .eq('user_id', userId);
  }

  const isExpired = new Date(connection.expires_at).getTime() <= Date.now() + 60_000; // 60s buffer
  if (!isExpired) return accessToken;

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabase
      .from('google_health_connections')
      .update({ access_token: encryptToken(refreshed.access_token), expires_at: newExpiresAt })
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
 * The scopes Google actually granted on the last connect (stored by the
 * callback), as a Set. Empty if unknown.
 */
export async function getGrantedScopes(supabase, userId) {
  const { data } = await supabase.from('google_health_connections').select('scopes').eq('user_id', userId).maybeSingle();
  return new Set(String(data?.scopes || '').split(/\s+/).filter(Boolean));
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

// Filter identifiers are snake_case ("daily_resting_heart_rate.date"), while
// the response fields are camelCase ("dailyRestingHeartRate"). Using the
// camelCase name in a filter returns 400, which is why resting heart rate,
// HRV and VO2 max came back empty.
const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
function dailyFilter(field, from, to) {
  const f = snake(field);
  return `${f}.date >= "${from}" AND ${f}.date < "${shiftDate(to, 1)}"`;
}

/** Daily summary points for a data type between two dates (inclusive). */
async function listDaily(accessToken, dataType, field, fromStr, toStr) {
  const filter = dailyFilter(field, fromStr, toStr);
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

/**
 * The day's heart-rate readings, for when the roll-up has nothing (e.g.
 * readings logged by hand in the Google Health app). Capped at a few pages:
 * a watch can record thousands of samples a day, and the roll-up covers those.
 */
async function heartSamplesForDay(accessToken, dateStr) {
  const points = await listAll(
    accessToken,
    'heart-rate',
    `heart_rate.sample_time.civil_time >= "${dateStr}" AND heart_rate.sample_time.civil_time < "${shiftDate(dateStr, 1)}"`,
    2000,
    3
  );
  const readings = points
    .map((p) => p.heartRate)
    .filter(Boolean)
    .map((h) => {
      const key = Object.keys(h).find((k) => /beats|bpm/i.test(k) && toNum(h[k]) !== null);
      const bpm = key ? toNum(h[key]) : null;
      const t = h.sampleTime?.physicalTime || '';
      return bpm ? { bpm, t } : null;
    })
    .filter(Boolean);
  if (!readings.length) return null;
  const vals = readings.map((r) => r.bpm);
  const latest = readings.reduce((a, r) => (r.t > a.t ? r : a));
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    latest: latest.bpm,
    latestTime: latest.t || null,
    count: readings.length,
  };
}

/**
 * Heart tile: today's LOW and HIGH (headline), average and latest reading,
 * resting heart rate (latest within 7 days), and irregular rhythm
 * notifications (7 days).
 *
 * Today's numbers come from the daily roll-up; if that is empty or fails,
 * from the day's individual readings, so manually logged heart rate shows
 * too. Failures are logged rather than silently treated as "no data".
 */
async function heartTile(accessToken, dateStr) {
  const from = shiftDate(dateStr, -6);
  const [rhr, day, irn] = await Promise.all([
    listDaily(accessToken, 'daily-resting-heart-rate', 'dailyRestingHeartRate', from, dateStr).catch((e) => {
      if (e.permissionDenied) throw e;
      console.warn('[google-health heart] resting:', e.message);
      return [];
    }),
    rollupOneDay(accessToken, 'heart-rate', dateStr).catch((e) => {
      if (e.permissionDenied) throw e;
      console.warn('[google-health heart] roll-up:', e.message);
      return null;
    }),
    settle(() =>
      listPoints(
        accessToken,
        'irregular-rhythm-notification',
        `irregular_rhythm_notification.interval.civil_start_time >= "${from}" AND irregular_rhythm_notification.interval.civil_start_time < "${shiftDate(dateStr, 1)}"`,
        10
      )
    ),
  ]);

  let st = statsOf(day);
  let latest = null;
  let latestTime = null;
  let source = 'rollup';
  if (st.min == null && st.max == null) {
    const samples = await heartSamplesForDay(accessToken, dateStr).catch((e) => {
      if (e.permissionDenied) throw e;
      console.warn('[google-health heart] samples:', e.message);
      return null;
    });
    if (samples) {
      st = samples;
      latest = samples.latest;
      latestTime = samples.latestTime;
      source = 'samples';
    }
  }

  const r = latestRest(rhr);
  const notes = (irn.data || [])
    .map((p) => dateStrOf(p.irregularRhythmNotification?.interval?.civilStartTime?.date))
    .filter(Boolean)
    .sort()
    .reverse();
  return {
    todayMin: st.min != null ? Math.round(st.min) : null,
    todayMax: st.max != null ? Math.round(st.max) : null,
    todayAvg: st.avg != null ? Math.round(st.avg) : null,
    latestBpm: latest != null ? Math.round(latest) : null,
    latestTime,
    source,
    restingBpm: r?.bpm ?? null,
    restingDate: r?.date ?? null,
    irregular: irn.needsPermission ? { needsPermission: true } : { count: notes.length, latestDate: notes[0] ?? null },
  };
}

function latestRest(points) {
  const r = latest(points);
  return r && toNum(r.p.beatsPerMinute) ? { bpm: Math.round(toNum(r.p.beatsPerMinute)), date: r.date } : null;
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
    `blood_glucose.sample_time.civil_time >= "${dateStr}" AND blood_glucose.sample_time.civil_time < "${shiftDate(dateStr, 1)}"`,
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
async function listAll(accessToken, dataType, filter, pageSize, maxPages = 20, endpoint = 'dataPoints') {
  const out = [];
  let token = '';
  for (let i = 0; i < maxPages; i += 1) {
    // encodeURIComponent, not URLSearchParams: URLSearchParams writes spaces
    // as '+', which the Health API doesn't read as a space, so every filter
    // ("x >= ... AND ...") was rejected and these lists came back empty.
    let q = `pageSize=${pageSize}&filter=${encodeURIComponent(filter)}`;
    if (token) q += `&pageToken=${encodeURIComponent(token)}`;
    const res = await fetch(`${HEALTH_BASE}/${dataType}/${endpoint}?${q}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (isPerm(res)) {
      const err = new Error('permission');
      err.permissionDenied = true;
      throw err;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${dataType} list ${res.status} ${body.slice(0, 300)}`);
    }
    const data = await res.json().catch(() => ({}));
    out.push(...(data.dataPoints || []));
    token = data.nextPageToken;
    if (!token) break;
  }
  return out;
}



/**
 * Sleep sessions that ended between from and to (inclusive), trying, in order:
 *   1. reconcile (all sources merged; Google's recommended read for sleep),
 *   2. a plain list over the range,
 *   3. one list per day (exactly what the home Sleep tile does, which works),
 * stopping at the first that returns anything. A permission error is thrown
 * at once; other errors fall through to the next method.
 */
async function fetchSleepRange(accessToken, from, to) {
  const filterFor = (a, b) => `sleep.interval.civil_end_time >= "${a}" AND sleep.interval.civil_end_time < "${shiftDate(b, 1)}"`;
  const errors = [];
  const attempt = async (label, fn) => {
    try {
      const pts = await fn();
      if (pts.length) return pts;
      errors.push(`${label}: 0 points`);
    } catch (e) {
      if (e.permissionDenied) throw e;
      errors.push(`${label}: ${e.message}`);
    }
    return null;
  };
  const reconciled = await attempt('reconcile', () => listAll(accessToken, 'sleep', filterFor(from, to), 25, 20, 'dataPoints:reconcile'));
  if (reconciled) return reconciled;
  const listed = await attempt('list', () => listAll(accessToken, 'sleep', filterFor(from, to), 25, 20));
  if (listed) return listed;
  const days = [];
  for (let d = from; d <= to && days.length < 62; d = shiftDate(d, 1)) days.push(d);
  const perDay = await attempt('per-day', async () => {
    const out = [];
    for (let i = 0; i < days.length; i += 7) {
      const batch = await Promise.all(days.slice(i, i + 7).map((d) => listPoints(accessToken, 'sleep', filterFor(d, d), 25).catch((e) => {
        if (e.permissionDenied) throw e;
        return [];
      })));
      for (const b of batch) out.push(...b);
    }
    return out;
  });
  if (perDay) return perDay;
  console.warn(`[google-health sleep] nothing for ${from}..${to}:`, errors.join(' | '));
  return [];
}

/** One sleep session as { d (date it ended), mins asleep, start, end (local minutes), main }. */
function sleepNight(sl) {
  const iv = sl?.interval || {};
  const start = civilMinutes(iv.civilStartTime) ?? localMinutes(iv.startTime, iv.startUtcOffset);
  const end = civilMinutes(iv.civilEndTime) ?? localMinutes(iv.endTime, iv.endUtcOffset ?? iv.startUtcOffset);
  const d = dateStrOf(iv.civilEndTime?.date) ?? (end != null ? new Date(end * 60000).toISOString().slice(0, 10) : null);
  const asleep = sl?.summary?.minutesAsleep;
  const mins = asleep != null ? toNum(asleep) : start != null && end != null ? end - start : null;
  return { d, mins, start, end, main: !!sl?.metadata?.mainSleep };
}

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
    // No roll-up data (e.g. only hand-logged readings): build the day's
    // low/high from the individual readings instead.
    if (!day.size && span <= HEART_RANGE_MAX_DAYS) {
      const pts = await listAll(
        token,
        'heart-rate',
        `heart_rate.sample_time.civil_time >= "${from}" AND heart_rate.sample_time.civil_time < "${shiftDate(to, 1)}"`,
        5000,
        4
      ).catch(rethrowPerm([]));
      const perDay = new Map();
      for (const p of pts) {
        const h = p.heartRate;
        const d = dateStrOf(h?.sampleTime?.civilTime?.date);
        const key = h && Object.keys(h).find((k) => /beats|bpm/i.test(k) && toNum(h[k]) !== null);
        if (!d || !key) continue;
        const v = toNum(h[key]);
        const cur = perDay.get(d) || { min: v, max: v };
        perDay.set(d, { min: Math.min(cur.min, v), max: Math.max(cur.max, v) });
      }
      for (const [d, mm] of perDay) day.set(d, { beatsPerMinuteMin: mm.min, beatsPerMinuteMax: mm.max });
    }

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
    const pts = await fetchSleepRange(token, from, to);
    // One value per night, keyed by the date the sleep ENDED; the main sleep wins.
    const byDay = new Map();
    for (const p of pts) {
      const n = sleepNight(p.sleep);
      if (!n.d || !n.mins) continue;
      const prev = byDay.get(n.d);
      if (!prev || n.main || n.mins > prev.mins) byDay.set(n.d, { mins: n.mins, main: n.main });
    }
    return { sleepHours: new Map([...byDay].map(([d, x]) => [d, Math.round((x.mins / 60) * 10) / 10])) };
  },
  async glucose(token, from, to) {
    const pts = await listAll(
      token,
      'blood-glucose',
      `blood_glucose.sample_time.civil_time >= "${from}" AND blood_glucose.sample_time.civil_time < "${shiftDate(to, 1)}"`,
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

/* ------------------------------------------------------------------ */
/* Body Age inputs (lib/bodyAge.js)                                    */
/* ------------------------------------------------------------------ */

// Body Age window = the range the user picked (Activity page) or the last
// 7 days (home tile), 7..180 days. Extra days are fetched behind it for the
// 30-day readiness baseline, Pace of Aging and the weekly trend.
export const BODY_AGE_MIN_DAYS = 7;
export const BODY_AGE_MAX_DAYS = 180;
const BODY_AGE_WEEKS = 4;
const PACE_BASE_DAYS = 30;
const VO2_LOOKBACK_DAYS = 90;
const STRENGTH_TYPES = /STRENGTH|WEIGHT|RESISTANCE|CROSSFIT|CALISTHENIC|CIRCUIT|KETTLEBELL|PILATES|BODYWEIGHT/i;

/** Roll-up objects over a long range, chunks fetched in parallel (4 at a time). */
async function rollupObjectsParallel(accessToken, dataType, fromStr, toStr, maxDays) {
  const chunks = [];
  for (let c = fromStr; c <= toStr; ) {
    const end = shiftDate(c, maxDays - 1) < toStr ? shiftDate(c, maxDays - 1) : toStr;
    chunks.push([c, end]);
    c = shiftDate(end, 1);
  }
  const out = new Map();
  for (let i = 0; i < chunks.length; i += 4) {
    const maps = await Promise.all(chunks.slice(i, i + 4).map(([a, b]) => dailyRollupObjects(accessToken, dataType, a, b, maxDays)));
    for (const m of maps) for (const [d, v] of m) out.set(d, v);
  }
  return out;
}

/** Local clock time of a civil date-time, as minutes on a continuous scale. */
const civilMinutes = (c) => {
  if (!c?.date?.year) return null;
  const day = Date.UTC(c.date.year, (c.date.month || 1) - 1, c.date.day || 1) / 60000;
  return day + (c.time?.hours ?? 0) * 60 + (c.time?.minutes ?? 0);
};

/** Physical time + offset ("19800s") as local minutes on the same scale as civilMinutes. */
const localMinutes = (iso, offset) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  const off = toNum(String(offset || '0').replace('s', '')) || 0;
  return d.getTime() / 60000 + off / 60;
};

const minutesOfIso = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime() / 60000;
};

/**
 * Everything Body Age needs for a window of `windowDays` days ending on `to`:
 * metric values over the window (Body Age), the last 7 days vs the last 30
 * (Pace of Aging), four weekly snapshots (trend) and day counts for the
 * prerequisites. Each source fails on its own: a missing permission is
 * reported, not thrown.
 */
export async function fetchBodyAgeInputs(accessToken, { to: toStr = null, windowDays = 7 } = {}) {
  const to = toStr || todayLocalDate();
  const win = Math.max(BODY_AGE_MIN_DAYS, Math.min(BODY_AGE_MAX_DAYS, Math.round(windowDays) || BODY_AGE_MIN_DAYS));
  const winFrom = shiftDate(to, -(win - 1));
  // Snapshots go back 3 more weeks; readiness / pace need 30 days.
  const from = shiftDate(to, -(Math.max(win, PACE_BASE_DAYS) - 1 + (BODY_AGE_WEEKS - 1) * 7));
  const weekFrom = shiftDate(to, -6);
  const perm = {};
  const failed = {};
  const guard = (key, p) =>
    p.catch((e) => {
      if (e.permissionDenied) perm[key] = true;
      else {
        failed[key] = true;
        console.warn(`[body-age] ${key}:`, e.message);
      }
      return null;
    });

  const [steps, zones, rhr, vo2, sleep, exercise, hrv] = await Promise.all([
    guard('steps', dailyRollupRange(accessToken, 'steps', from, to, 90, (p) => toNum(p.steps?.countSum ?? p.steps?.count ?? statsOf(p.steps).sum))),
    guard('zones', rollupObjectsParallel(accessToken, 'active-zone-minutes', from, to, 14)),
    guard('restingHr', listAll(accessToken, 'daily-resting-heart-rate', dailyFilter('dailyRestingHeartRate', from, to), 1000)),
    guard('vo2', listAll(accessToken, 'daily-vo2-max', dailyFilter('dailyVo2Max', shiftDate(to, -(VO2_LOOKBACK_DAYS + 21)), to), 1000)),
    guard('sleep', fetchSleepRange(accessToken, from, to)),
    guard('exercise', listAll(accessToken, 'exercise', `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${shiftDate(to, 1)}"`, 25, 16)),
    // Nightly HRV, for Readiness (lib/readiness.js); not used in Body Age.
    guard('hrv', listAll(accessToken, 'daily-heart-rate-variability', dailyFilter('dailyHeartRateVariability', from, to), 1000)),
  ]);

  const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);
  const between = (lo, hi) => (d) => d >= lo && d <= hi;

  // Steps: days actually worn (>= 500 steps).
  const stepDays = steps ? [...steps].filter(([, v]) => v >= 500) : [];
  // Zone minutes per day: moderate = fat burn, vigorous = cardio + peak.
  const zoneDays = [];
  for (const [d, o] of zones || []) {
    let mod = 0;
    let vig = 0;
    let any = false;
    for (const [k, v] of Object.entries(o || {})) {
      const n = toNum(v);
      if (n === null) continue;
      any = true;
      if (/fat/i.test(k)) mod += n;
      else if (/cardio|peak/i.test(k)) vig += n;
    }
    if (any) zoneDays.push({ d, mod, vig });
  }
  const rhrRows = (rhr || [])
    .map((p) => ({ d: dateStrOf(p.dailyRestingHeartRate?.date), v: toNum(p.dailyRestingHeartRate?.beatsPerMinute) }))
    .filter((r) => r.d && r.v);
  const vo2Rows = (vo2 || [])
    .map((p) => ({ d: dateStrOf(p.dailyVo2Max?.date), v: numberField(p.dailyVo2Max, 'vo2') }))
    .filter((r) => r.d && r.v)
    .sort((a, b) => (a.d < b.d ? 1 : -1));

  // Sleep: main sleep per night, from local (civil) times.
  const nights = new Map();
  for (const p of sleep || []) {
    const sl = p.sleep;
    const { d, mins, start, end } = sleepNight(sl);
    if (!d || !mins) continue;
    const prev = nights.get(d);
    if (!prev || sl.metadata?.mainSleep || mins > prev.mins) nights.set(d, { d, mins, start, end, mid: start != null && end != null ? (start + end) / 2 : null });
  }
  const nightRows = [...nights.values()];
  if ((sleep || []).length && !nightRows.length) {
    console.warn('[body-age] sleep: points returned but none parsed; first point:', JSON.stringify(sleep[0]).slice(0, 600));
  }
  // Sleep midpoint as local clock minutes, unwrapped around midnight (noon..noon+24h).
  const clockMid = (r) => {
    let m = ((r.mid % 1440) + 1440) % 1440;
    if (m < 720) m += 1440;
    return m;
  };
  const sd = (arr) => {
    if (arr.length < 2) return null;
    const m = avg(arr);
    return Math.sqrt(arr.reduce((x, v) => x + (v - m) ** 2, 0) / (arr.length - 1));
  };

  // Strength training sessions.
  const strength = (exercise || [])
    .map((p) => p.exercise)
    .filter((e) => e && STRENGTH_TYPES.test(String(e.exerciseType || e.activityType || e.displayName || '')))
    .map((e) => {
      const d = dateStrOf(e.interval?.civilStartTime?.date);
      const a = minutesOfIso(e.interval?.startTime);
      const b = minutesOfIso(e.interval?.endTime);
      const active = toNum(String(e.activeDuration || '').replace('s', ''));
      return { d, min: active ? active / 60 : a != null && b != null ? b - a : 0 };
    })
    .filter((r) => r.d);

  /**
   * Metric values for one window of `days` days ending on `end`. Weekly
   * figures (zone and strength minutes) are per 7 days of the window;
   * daily ones (steps, sleep, resting HR) are averages over days with data.
   */
  const windowValues = (end, days, minNightsForSd = 7) => {
    const inWin = between(shiftDate(end, -(days - 1)), end);
    const z = zoneDays.filter((r) => inWin(r.d));
    const n = nightRows.filter((r) => inWin(r.d));
    const sDays = stepDays.filter(([d]) => inWin(d));
    const zoneSpan = Math.max(z.length, 1);
    const wornSpan = Math.max(sDays.length, Math.min(days, 7));
    const v = vo2Rows.filter((r) => r.d <= end && r.d >= shiftDate(end, -(VO2_LOOKBACK_DAYS - 1)));
    return {
      steps: avg(sDays.map(([, x]) => x)),
      moderateMinWeek: z.length ? (z.reduce((a, r) => a + r.mod, 0) / zoneSpan) * 7 : null,
      vigorousMinWeek: z.length ? (z.reduce((a, r) => a + r.vig, 0) / zoneSpan) * 7 : null,
      strengthMinWeek: sDays.length ? (strength.filter((r) => inWin(r.d)).reduce((a, r) => a + r.min, 0) / wornSpan) * 7 : null,
      restingHr: avg(rhrRows.filter((r) => inWin(r.d)).map((r) => r.v)),
      sleepHours: n.length ? avg(n.map((r) => r.mins / 60)) : null,
      sleepMidpointSdMin: n.filter((r) => r.mid != null).length >= minNightsForSd ? sd(n.filter((r) => r.mid != null).map(clockMid)) : null,
      vo2: v.length ? avg(v.slice(0, 3).map((r) => r.v)) : null,
    };
  };

  // Per-day series for Readiness / Recovery: HRV, resting HR, sleep minutes.
  const daily = new Map();
  const put = (d, k, v) => {
    if (!d || v == null) return;
    daily.set(d, { ...(daily.get(d) || { date: d }), [k]: v });
  };
  for (const p of hrv || []) {
    const o = p.dailyHeartRateVariability;
    put(dateStrOf(o?.date), 'hrv', toNum(o?.averageHeartRateVariabilityMilliseconds) ?? numberField(o, 'variability'));
  }
  for (const r of rhrRows) put(r.d, 'rhr', r.v);
  for (const n of nightRows) put(n.d, 'sleepMin', n.mins);

  const inWindow = between(winFrom, to);
  const paceBase = windowValues(to, PACE_BASE_DAYS);
  const paceBaseDays = stepDays.filter(([d]) => d >= shiftDate(to, -(PACE_BASE_DAYS - 1)) && d <= to).length;
  return {
    windowDays: win,
    from: winFrom,
    to,
    daily: [...daily.values()],
    sleepMidpointSd30: windowValues(to, PACE_BASE_DAYS).sleepMidpointSdMin,
    // Sleep timing over the selected window: how much the middle of the night
    // moves (Sleep consistency) plus typical bed and wake times.
    sleepTiming: (() => {
      const rows = nightRows.filter((r) => inWindow(r.d) && r.mid != null);
      if (rows.length < Math.min(5, Math.ceil(win * 0.7))) return { nights: rows.length, sdMin: null };
      const clock = (m, pivot) => {
        let x = ((m % 1440) + 1440) % 1440;
        if (x < pivot) x += 1440;
        return x;
      };
      const hhmm = (m) => {
        const x = Math.round(((m % 1440) + 1440) % 1440);
        return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
      };
      return {
        nights: rows.length,
        sdMin: Math.round(sd(rows.map(clockMid))),
        bedtime: hhmm(avg(rows.map((r) => clock(r.start, 720)))), // noon pivot: 23:30 and 00:30 average to midnight
        wake: hhmm(avg(rows.map((r) => clock(r.end, 0)))),
      };
    })(),
    long: windowValues(to, win, Math.min(7, Math.ceil(win * 0.7))),
    recent: windowValues(to, 7, 4),
    // Pace compares the last 7 days with the last 30, whatever the range;
    // null until there are two weeks to compare against.
    paceBase: paceBaseDays >= 14 ? paceBase : null,
    // Body Age at the end of each of the last 4 weeks (oldest first).
    snapshots: Array.from({ length: BODY_AGE_WEEKS }, (_, i) => {
      const end = shiftDate(to, -7 * (BODY_AGE_WEEKS - 1 - i));
      return { end, values: windowValues(end, win, Math.min(7, Math.ceil(win * 0.7))) };
    }),
    counts: {
      steps: stepDays.filter(([d]) => inWindow(d)).length,
      zones: zoneDays.filter((r) => inWindow(r.d)).length,
      restingHr: rhrRows.filter((r) => inWindow(r.d)).length,
      sleep: nightRows.filter((r) => inWindow(r.d)).length,
      recent: stepDays.filter(([d]) => d >= weekFrom && d <= to).length,
      vo2: vo2Rows.filter((r) => r.d <= to && r.d >= shiftDate(to, -(VO2_LOOKBACK_DAYS - 1))).length,
      wornDays: stepDays.filter(([d]) => inWindow(d)).length,
    },
    latestVo2Date: vo2Rows.find((r) => r.d <= to)?.d ?? null,
    needsPermission: perm,
    failed,
    // Raw point counts per source, to tell "no data" from "not parsed".
    sourceCounts: { sleep: sleep?.length ?? null, restingHr: rhr?.length ?? null, hrv: hrv?.length ?? null, vo2: vo2?.length ?? null },
  };
}


/* ------------------------------------------------------------------ */
/* Recovery · Strain · Sleep (lib/dailyLoad.js)                          */
/* ------------------------------------------------------------------ */

/**
 * Per-day inputs for Recovery, Strain and Sleep, ascending by date:
 * [{ date, steps, fat, cardio, peak, hrv, rhr, sleepMin, wakeClock, latency }].
 * Covers `days` days ending on `to`, plus 30 days before for the personal
 * baselines (HRV, resting HR, sleep). Missing permissions just leave fields
 * empty; `needsPermission` says which.
 */
export async function fetchDailyLoadInputs(accessToken, to, days = 1) {
  const span = Math.max(1, Math.min(31, days));
  const from = shiftDate(to, -(span - 1));
  const baseFrom = shiftDate(from, -30);
  const loadFrom = shiftDate(from, -1); // yesterday's strain feeds sleep need
  const perm = {};
  const guard = (key, p) =>
    p.catch((e) => {
      if (e.permissionDenied) perm[key] = true;
      else console.warn(`[daily-load] ${key}:`, e.message);
      return null;
    });

  const [steps, zones, hrv, rhr, sleep] = await Promise.all([
    guard('activity', dailyRollupRange(accessToken, 'steps', loadFrom, to, 90, (p) => toNum(p.steps?.countSum ?? p.steps?.count))),
    guard('activity', rollupObjectsParallel(accessToken, 'active-zone-minutes', loadFrom, to, 14)),
    guard('metrics', listAll(accessToken, 'daily-heart-rate-variability', dailyFilter('dailyHeartRateVariability', baseFrom, to), 1000)),
    guard('metrics', listAll(accessToken, 'daily-resting-heart-rate', dailyFilter('dailyRestingHeartRate', baseFrom, to), 1000)),
    guard('sleep', fetchSleepRange(accessToken, baseFrom, to)),
  ]);

  const rows = new Map();
  const put = (d, k, v) => {
    if (!d || v == null || !Number.isFinite(v)) return;
    rows.set(d, { ...(rows.get(d) || { date: d }), [k]: v });
  };
  for (const [d, v] of steps || []) put(d, 'steps', v);
  for (const [d, o] of zones || []) {
    let fat = 0;
    let cardio = 0;
    let peak = 0;
    let any = false;
    for (const [k, v] of Object.entries(o || {})) {
      const n = toNum(v);
      if (n == null) continue;
      if (/fat/i.test(k)) (fat += n), (any = true);
      else if (/cardio/i.test(k)) (cardio += n), (any = true);
      else if (/peak/i.test(k)) (peak += n), (any = true);
    }
    if (any) {
      put(d, 'fat', fat);
      put(d, 'cardio', cardio);
      put(d, 'peak', peak);
    }
  }
  for (const p of hrv || []) {
    const o = p.dailyHeartRateVariability;
    put(dateStrOf(o?.date), 'hrv', toNum(o?.averageHeartRateVariabilityMilliseconds) ?? numberField(o, 'variability'));
  }
  for (const p of rhr || []) {
    const o = p.dailyRestingHeartRate;
    put(dateStrOf(o?.date), 'rhr', toNum(o?.beatsPerMinute));
  }
  const nights = new Map();
  for (const p of sleep || []) {
    const n = sleepNight(p.sleep);
    if (!n.d || !n.mins) continue;
    const prev = nights.get(n.d);
    if (!prev || n.main || n.mins > prev.mins) nights.set(n.d, { ...n, latency: toNum(p.sleep?.summary?.minutesToFallAsleep) });
  }
  for (const [d, n] of nights) {
    put(d, 'sleepMin', n.mins);
    if (n.end != null) put(d, 'wakeClock', ((n.end % 1440) + 1440) % 1440);
    if (n.latency != null) put(d, 'latency', n.latency);
  }
  return { days: [...rows.values()].sort((a, b) => (a.date < b.date ? -1 : 1)), from, to, needsPermission: perm };
}
