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
export const ALL_SCOPES = [ACTIVITY_SCOPE, NUTRITION_WRITE_SCOPE, METRICS_WRITE_SCOPE];

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_HEALTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true', // keep read access if a reconnect only adds the write scopes
    prompt: 'consent', // forces a refresh_token on every authorization, not just the first-ever consent
    scope: ALL_SCOPES.join(' '),
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