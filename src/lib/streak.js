/**
 * lib/streak.js
 * Food-logging streak: consecutive days with at least one food log, ending
 * today (or yesterday, so an unlogged morning doesn't break it), plus the
 * tier that decides how the streak card looks.
 */

import { addDays } from './dateUtils';

// Each tier looks a little better than the one before it.
export const STREAK_TIERS = [
  { min: 0, key: 'none', name: 'No streak', color: '#64748b', glow: null, next: 1 },
  { min: 1, key: 'spark', name: 'Spark', color: '#fbbf24', glow: null, next: 3 },
  { min: 3, key: 'kindling', name: 'Kindling', color: '#fb923c', glow: 'rgba(251,146,60,.18)', next: 7 },
  { min: 7, key: 'fire', name: 'On fire', color: '#f97316', glow: 'rgba(249,115,22,.26)', next: 14 },
  { min: 14, key: 'blaze', name: 'Blazing', color: '#fb7185', glow: 'rgba(251,113,133,.28)', next: 30 },
  { min: 30, key: 'inferno', name: 'Inferno', color: '#c084fc', glow: 'rgba(192,132,252,.32)', next: 100 },
  { min: 100, key: 'legend', name: 'Legendary', color: '#facc15', glow: 'rgba(250,204,21,.38)', next: null },
];

export function streakTier(n) {
  let t = STREAK_TIERS[0];
  for (const tier of STREAK_TIERS) if (n >= tier.min) t = tier;
  const nextTier = t.next ? STREAK_TIERS.find((x) => x.min === t.next) : null;
  return { ...t, level: STREAK_TIERS.indexOf(t), nextTier };
}

/** days: Set of YYYY-MM-DD with food logged. */
export function computeStreak(days, today) {
  const loggedToday = days.has(today);
  let d = loggedToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(d)) {
    current += 1;
    d = addDays(d, -1);
  }
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, on: days.has(date) };
  });
  return { current, loggedToday, last7 };
}

const WINDOW = 45; // days per request, small enough to stay under the row cap

/**
 * Reads only the days needed: 45-day windows backwards until the streak
 * breaks (at most ~1 year).
 */
export async function loadStreak(supabase, userId, today) {
  const days = new Set();
  let to = today;
  for (let i = 0; i < 9; i += 1) {
    const from = addDays(to, -(WINDOW - 1));
    const { data, error } = await supabase.from('food_logs').select('logged_at').eq('user_id', userId).gte('logged_at', from).lte('logged_at', to);
    if (error) break;
    for (const r of data || []) days.add(r.logged_at);
    const s = computeStreak(days, today);
    const breakDay = addDays(s.loggedToday ? today : addDays(today, -1), -s.current);
    // Stop once the run ends inside the data read so far.
    if (!days.has(from) || breakDay >= from) break;
    to = addDays(from, -1);
  }
  return computeStreak(days, today);
}
