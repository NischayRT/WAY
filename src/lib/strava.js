// src/lib/strava.js

const STRAVA_TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token';
const STRAVA_AUTH_ENDPOINT = 'https://www.strava.com/oauth/authorize';

export function buildStravaAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  return `${STRAVA_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeStravaCodeForTokens(code) {
  const res = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to exchange Strava code');
  return data; // { access_token, refresh_token, expires_at, ... }
}

export async function getValidStravaAccessToken(supabase, userId) {
  const { data: connection } = await supabase
    .from('strava_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!connection) return null;

  const isExpired = connection.expires_at * 1000 <= Date.now() + 60_000;
  if (!isExpired) return connection.access_token;

  // Refresh token
  const res = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await res.json();
  if (!res.ok) {
    await supabase.from('strava_connections').delete().eq('user_id', userId);
    return null;
  }

  await supabase
    .from('strava_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

export async function fetchStravaDailyMetrics(accessToken, targetDateStr) {
  const targetDate = targetDateStr ? new Date(`${targetDateStr}T00:00:00`) : new Date();
  
  const before = Math.floor(new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59).getTime() / 1000);
  const after = Math.floor(new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0).getTime() / 1000);

  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?before=${before}&after=${after}&per_page=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch Strava activities');

  const activities = await res.json();

  let totalMeters = 0;
  // Strava does not track background steps natively, but we calculate distance across logged activities
  for (const activity of activities) {
    totalMeters += activity.distance || 0;
  }

  return {
    steps: 0, // Strava API only provides workout distance/time, not general step counting
    distanceKm: Number((totalMeters / 1000).toFixed(2)),
    provider: 'strava',
  };
}