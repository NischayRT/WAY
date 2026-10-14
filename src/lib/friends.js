/**
 * lib/friends.js
 * Pure helpers for the Friends screen: the shareable fields, levels and
 * titles, the leaderboard, the live feed, weekly quests and badges.
 * All inputs are rows the database already allowed this user to see.
 */

import { addDays } from './dateUtils';

export const FIELDS = {
  steps: { label: 'Steps', unit: 'steps', color: '#60a5fa', agg: 'sum', dec: 0, compete: true },
  distance_km: { label: 'Distance', unit: 'km', color: '#34d399', agg: 'sum', dec: 1, compete: true },
  active_kcal: { label: 'Active cal', unit: 'kcal', color: '#a78bfa', agg: 'sum', dec: 0, compete: true },
  floors: { label: 'Floors', unit: 'floors', color: '#f59e0b', agg: 'sum', dec: 0, compete: true },
  sleep_hours: { label: 'Sleep', unit: 'h', color: '#818cf8', agg: 'avg', dec: 1, compete: true },
  resting_hr: { label: 'Resting HR', unit: 'bpm', color: '#fb7185', agg: 'avg', dec: 0, sensitive: true },
  weight_kg: { label: 'Weight', unit: 'kg', color: '#38bdf8', agg: 'last', dec: 1, sensitive: true },
  calories_in: { label: 'Calories eaten', unit: 'kcal', color: '#fbbf24', agg: 'avg', dec: 0, sensitive: true },
  protein_g: { label: 'Protein', unit: 'g', color: '#10b981', agg: 'avg', dec: 0, sensitive: true },
};
export const FIELD_KEYS = Object.keys(FIELDS);
export const COMPETE_KEYS = FIELD_KEYS.filter((k) => FIELDS[k].compete);

export const fmtVal = (v, dec = 0) => (v == null ? '—' : dec ? Number(v).toFixed(dec) : Math.round(v).toLocaleString('en-IN'));

/* ---------- people ---------- */

const AVATARS = [
  ['#f472b6', '#3b0a24'],
  ['#60a5fa', '#0b1f3a'],
  ['#c084fc', '#2a0b3d'],
  ['#fbbf24', '#2a1a00'],
  ['#2dd4bf', '#04241f'],
  ['#fb923c', '#2a1100'],
  ['#fda4af', '#3b0a14'],
  ['#a3e635', '#1a2a00'],
  ['#94a3b8', '#0b1220'],
];
/** Stable avatar colours from the username; you are always green. */
export function avatarOf(person, isMe) {
  if (isMe) return { bg: '#10b981', fg: '#052e1f' };
  const s = String(person?.username || person?.id || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [bg, fg] = AVATARS[h % AVATARS.length];
  return { bg, fg };
}
export const displayName = (p) => (p?.full_name && p.full_name.trim()) || (p?.username ? `@${p.username}` : 'Someone');
export const initialOf = (p) => (displayName(p).replace('@', '').charAt(0) || '?').toUpperCase();

/* ---------- XP and levels ---------- */

export const XP_PER_LEVEL = 1000;
const TITLES = ['ROOKIE', 'WALKER', 'PACER', 'STRIDER', 'RUNNER', 'ATHLETE', 'CHAMPION', 'LEGEND'];
export function levelOf(xp = 0) {
  const level = 1 + Math.floor(xp / XP_PER_LEVEL);
  const into = xp % XP_PER_LEVEL;
  const tier = TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
  const roman = ['I', 'II', 'III'][(level - 1) % 3];
  return { level, into, pct: (into / XP_PER_LEVEL) * 100, title: `${tier} · TIER ${roman}` };
}

/* ---------- seasons (weeks, Monday to Sunday) ---------- */

export function weekStart(today) {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(today, -dow);
}
export function seasonInfo(today, now = new Date()) {
  const ws = weekStart(today);
  const end = new Date(`${addDays(ws, 7)}T00:00:00+05:30`);
  const ms = Math.max(0, end - now);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const week = Math.ceil((new Date(`${ws}T00:00:00Z`) - new Date(`${ws.slice(0, 4)}-01-01T00:00:00Z`)) / (7 * 86400000)) + 1;
  return { weekStart: ws, left: `${days}d ${hours}h left`, label: `SEASON ${week} · ENDS SUN 11:59 PM` };
}

/* ---------- stats ---------- */

/** stats rows -> Map(userId -> Map(field -> Map(day -> value))) */
export function indexStats(rows = []) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.user_id)) out.set(r.user_id, new Map());
    const u = out.get(r.user_id);
    if (!u.has(r.field)) u.set(r.field, new Map());
    u.get(r.field).set(r.day, Number(r.value));
  }
  return out;
}

/** Aggregate one field over [from, to] for one person; null when no data. */
export function aggregate(byDay, field, from, to) {
  if (!byDay) return null;
  const vals = [];
  let lastDay = null;
  let last = null;
  for (const [day, v] of byDay) {
    if (day < from || day > to || v == null) continue;
    vals.push(v);
    if (!lastDay || day > lastDay) {
      lastDay = day;
      last = v;
    }
  }
  if (!vals.length) return null;
  const agg = FIELDS[field]?.agg || 'sum';
  if (agg === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (agg === 'last') return last;
  return vals.reduce((a, b) => a + b, 0);
}

export const PERIODS = { today: 1, week: 7, month: 30 };

/**
 * Ranked board for one metric and period. Competitors are included only if
 * the metric is among the fields agreed with them.
 * @returns { ranked: [{id, v, pv, rank, move}], missing: [id] }
 */
export function buildBoard({ meId, competitors, stats, metric, period, today }) {
  const n = PERIODS[period];
  const from = addDays(today, -(n - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(n - 1));
  const people = [{ id: meId }, ...competitors.filter((c) => c.fields.includes(metric))];
  const rows = people.map((p) => {
    const byDay = stats.get(p.id)?.get(metric);
    return { id: p.id, v: aggregate(byDay, metric, from, today), pv: period === 'month' ? null : aggregate(byDay, metric, prevFrom, prevTo) };
  });
  const ranked = rows.filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const prevOrder = rows.filter((r) => r.pv != null).sort((a, b) => b.pv - a.pv).map((r) => r.id);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
    const p = prevOrder.indexOf(r.id);
    r.move = p < 0 ? 0 : p - i;
  });
  return { ranked, missing: rows.filter((r) => r.v == null).map((r) => r.id) };
}

/* ---------- feed ---------- */

const EVENTS = [
  { type: 'steps10k', field: 'steps', test: (v) => v >= 10000, text: (v) => `hit ${fmtVal(v)} steps`, icon: 'footprints', bg: '#60a5fa' },
  { type: 'km10', field: 'distance_km', test: (v) => v >= 10, text: (v) => `covered ${fmtVal(v, 1)} km in a day`, icon: 'navigation', bg: '#34d399' },
  { type: 'floors20', field: 'floors', test: (v) => v >= 20, text: (v) => `climbed ${fmtVal(v)} floors`, icon: 'building', bg: '#f59e0b' },
  { type: 'burn600', field: 'active_kcal', test: (v) => v >= 600, text: (v) => `burned ${fmtVal(v)} active kcal`, icon: 'flame', bg: '#a78bfa' },
  { type: 'sleep8', field: 'sleep_hours', test: (v) => v >= 8, text: (v) => `slept ${fmtVal(v, 1)} h`, icon: 'moon', bg: '#818cf8' },
];

/** Recent wins from competitors' agreed fields (last 7 days), newest first. */
export function buildFeed({ competitors, stats, today, limit = 8 }) {
  const since = addDays(today, -6);
  const out = [];
  for (const c of competitors) {
    const u = stats.get(c.id);
    if (!u) continue;
    for (const e of EVENTS) {
      if (!c.fields.includes(e.field)) continue;
      const byDay = u.get(e.field);
      if (!byDay) continue;
      const hits = [...byDay].filter(([day, v]) => day >= since && e.test(v)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
      if (hits.length) {
        const [day, v] = hits[0];
        out.push({ key: `${c.id}:${e.type}:${day}`, personId: c.id, day, text: e.text(v), icon: e.icon, iconBg: e.bg });
      }
    }
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, limit);
}

export function relDay(day, today) {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ---------- quests and badges ---------- */

export const QUESTS = [
  { id: 'steps', label: 'Walk 70,000 steps', goal: 70000, xp: 300, icon: 'footprints' },
  { id: 'food', label: 'Log food 7 days in a row', goal: 7, xp: 150, icon: 'utensils' },
  { id: 'cheer', label: 'Cheer 3 friends', goal: 3, xp: 50, icon: 'party' },
  { id: 'sleep', label: 'Sleep 7 h+ on 5 nights', goal: 5, xp: 200, icon: 'moon' },
];

/** Progress for each weekly quest from your own numbers. */
export function questProgress({ mine, foodDays, cheeredThisWeek, ws, today }) {
  const inWeek = (m) => [...(m || new Map())].filter(([d]) => d >= ws && d <= today);
  const steps = inWeek(mine?.get('steps')).reduce((a, [, v]) => a + v, 0);
  const sleep = inWeek(mine?.get('sleep_hours')).filter(([, v]) => v >= 7).length;
  let food = 0;
  for (let i = 0; i < 7; i += 1) if (foodDays.has(addDays(today, -i))) food += 1;
  return { steps, food, cheer: cheeredThisWeek, sleep };
}

/** Longest current run of days with food logged, ending today or yesterday. */
export function logStreak(foodDays, today) {
  let d = foodDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (foodDays.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

export function badgesFor({ mine, foodStreak, duelWins, today }) {
  const last = (field, days) => [...(mine?.get(field) || new Map())].filter(([d]) => d > addDays(today, -days) && d <= today);
  const steps7 = last('steps', 7).filter(([, v]) => v >= 10000).length;
  const km30 = last('distance_km', 30).reduce((a, [, v]) => a + v, 0);
  const floors30 = last('floors', 30).reduce((a, [, v]) => a + v, 0);
  const sleep30 = last('sleep_hours', 30).filter(([, v]) => v >= 7).length;
  return [
    { id: '10k', label: '10k Club', icon: 'footprints', color: '#60a5fa', p: steps7 / 7, prog: `${steps7}/7 days` },
    { id: 'duelist', label: 'Duelist', icon: 'swords', color: '#fb7185', p: duelWins / 5, prog: `${duelWins}/5 wins` },
    { id: 'streak', label: 'Streak 30', icon: 'flame', color: '#fb923c', p: foodStreak / 30, prog: `${Math.min(foodStreak, 30)}/30` },
    { id: 'century', label: 'Century', icon: 'navigation', color: '#34d399', p: km30 / 100, prog: `${Math.round(km30)}/100 km` },
    { id: 'climber', label: 'Climber', icon: 'building', color: '#f59e0b', p: floors30 / 150, prog: `${Math.round(floors30)}/150` },
    { id: 'sleeper', label: 'Well rested', icon: 'moon', color: '#818cf8', p: sleep30 / 20, prog: `${sleep30}/20 nights` },
  ].map((b) => ({ ...b, got: b.p >= 1, p: Math.min(1, b.p) }));
}
