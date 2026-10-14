/**
 * lib/daily.js
 * Pure helpers behind the Today screen: grouping a day's logs into four meal
 * budgets, the Daily Score, and turning raw health numbers into tile states.
 */

/** Four meal budgets. Snacks also collect beverages and anything unfiled. */
export const MEAL_GROUPS = [
  { key: 'breakfast', label: 'Breakfast', frac: 0.25, types: ['breakfast'] },
  { key: 'lunch', label: 'Lunch', frac: 0.35, types: ['lunch'] },
  { key: 'snacks', label: 'Snacks', frac: 0.1, types: ['mid_day_snack', 'evening_snack', 'beverage', 'other'] },
  { key: 'dinner', label: 'Dinner', frac: 0.3, types: ['dinner'] },
];

/** The meal_type a new snack is filed under, by the clock (before 4 pm = mid-day). */
export function snackMealType(date = new Date()) {
  return date.getHours() < 16 ? 'mid_day_snack' : 'evening_snack';
}

/** Group key -> the meal_type to log into. */
export function mealTypeForGroup(key, date) {
  return key === 'snacks' ? snackMealType(date) : key;
}

/** meal_type -> group key. */
export function groupForMealType(type) {
  return (MEAL_GROUPS.find((g) => g.types.includes(type)) || MEAL_GROUPS[2]).key;
}

/** Nutrition of one food_logs row (foods values are per 100 g). */
export function logNutrition(log) {
  const r = (Number(log.quantity_g) || 0) / 100;
  const f = log.foods || {};
  return {
    calories: (Number(f.calories_kcal) || 0) * r,
    protein: (Number(f.protein_g) || 0) * r,
    carbs: (Number(f.carbs_g) || 0) * r,
    fat: (Number(f.fat_g) || 0) * r,
  };
}

/**
 * The day's logs as four meals, each with its items, totals and budget.
 * @param categories computeMealBreakdown(...).categories
 */
export function groupMeals(categories = [], targetCalories = 0) {
  const byType = new Map(categories.map((c) => [c.value, c]));
  return MEAL_GROUPS.map((g) => {
    const items = [];
    for (const t of g.types) {
      const cat = byType.get(t);
      if (cat) items.push(...cat.items.map((log) => ({ log, mealType: t, ...logNutrition(log) })));
    }
    const totals = items.reduce(
      (a, x) => ({ calories: a.calories + x.calories, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return { ...g, items, totals, budget: Math.round(targetCalories * g.frac) };
  });
}

/** Default goals used only for the score when the user hasn't set their own. */
export const SCORE_DEFAULT_GOALS = { steps: 10000, burnKcal: 500 };

/**
 * Daily Score, 0..100.
 * Food: calories, protein (more is fine), carbs and fat each count a quarter.
 * While a day is open, being under target isn't penalised; once it has
 * closed, finishing more than 10% under is. Going over 10% always costs.
 * Activity: steps and active calories against their goals. Counted only when
 * Google Health is connected; then food weighs `foodWeight` (0.6 by default).
 */
export function dailyScore({ totals, targets, closed, connected, activity, goals = {}, foodWeight = 0.6 }) {
  const comp = (v, t, more) => {
    if (!(t > 0)) return 0;
    const r = v / t;
    if (more) return Math.min(r, 1) * 100;
    if (r > 1.1) return Math.max(0, 100 - (r - 1.1) * 300);
    if (closed) return r >= 0.9 ? 100 : Math.max(0, 100 - (0.9 - r) * 300);
    return Math.min(r, 1) * 100;
  };
  const food =
    (comp(totals.calories, targets.targetCalories) +
      comp(totals.protein, targets.proteinG, true) +
      comp(totals.carbs, targets.carbsG) +
      comp(totals.fat, targets.fatG)) /
    4;
  const stepGoal = goals.steps || SCORE_DEFAULT_GOALS.steps;
  const burnGoal = goals.burnKcal || SCORE_DEFAULT_GOALS.burnKcal;
  const act = connected
    ? ((Math.min((activity?.steps || 0) / stepGoal, 1) + Math.min((activity?.activeCalories || 0) / burnGoal, 1)) / 2) * 100
    : 0;
  const score = Math.round(connected ? foodWeight * food + (1 - foodWeight) * act : food);
  const tone = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#fb7185';
  const tag = !closed ? 'In progress' : score >= 85 ? 'Excellent' : score >= 70 ? 'Solid' : score >= 55 ? 'Fair' : 'Off track';
  return { score, food, act, tone, tag };
}

/** Week-strip dot: on target (green), under (amber), over (red), open day (ring). */
export function dayDot({ calories, target, closed, hasLogs }) {
  if (!closed) return { kind: 'open' };
  if (!hasLogs || !(target > 0)) return { kind: 'none' };
  const dev = (calories - target) / target;
  if (Math.abs(dev) <= 0.1) return { kind: 'on', color: '#34d399' };
  return dev < 0 ? { kind: 'under', color: '#fbbf24' } : { kind: 'over', color: '#fb7185' };
}

/* ------------------------------------------------------------------ */
/* Health tiles                                                        */
/* ------------------------------------------------------------------ */

export const TILE_DEFS = [
  { key: 'steps', label: 'Steps', color: '#60a5fa', hint: 'Steps vs your daily step goal' },
  { key: 'distance', label: 'Distance', color: '#34d399', hint: 'Distance walked or run' },
  { key: 'energy', label: 'Energy burned', color: '#fbbf24', hint: 'Active calories vs burn goal' },
  { key: 'heart', label: 'Heart rate', color: '#fb7185', hint: 'Resting, low and high today' },
  { key: 'oxygen', label: 'SpO₂ & VO₂ max', color: '#22d3ee', hint: 'Overnight blood oxygen and cardio fitness' },
  { key: 'floors', label: 'Floors climbed', color: '#f59e0b', hint: 'Floors vs a 10-floor goal' },
  { key: 'sleep', label: 'Sleep', color: '#818cf8', hint: 'Last night vs 7–9 h (needs sleep access)' },
  { key: 'glucose', label: 'Glucose', color: '#2dd4bf', hint: 'Blood glucose readings logged today' },
];
export const TILE_KEYS = TILE_DEFS.map((t) => t.key);
export const DEFAULT_TILE_KEYS = ['steps', 'distance', 'energy', 'heart'];
export const FLOORS_GOAL = 10;

const n0 = (n) => Math.round(n).toLocaleString('en-IN');

function goalTile(v, goal, { unitWord = '', valStr, unit, dec = 0 }) {
  if (!(goal > 0)) {
    return { v: valStr, unit, pct: null, status: 'info', hasGoal: false, sub: 'No goal set · add one in Settings' };
  }
  const pct = (v / goal) * 100;
  const status = pct >= 120 ? 'exceeded' : pct >= 100 ? 'reached' : 'progress';
  const g = dec ? goal.toFixed(dec) : n0(goal);
  const over = dec ? (v - goal).toFixed(dec) : n0(v - goal);
  return {
    v: valStr,
    unit,
    pct,
    status,
    hasGoal: true,
    sub:
      status === 'progress'
        ? `${Math.round(pct)}% of ${g}${unitWord} goal`
        : status === 'reached'
          ? `Goal of ${g}${unitWord} reached`
          : `${Math.round(pct)}% of goal`,
    badge: status === 'exceeded' ? `+${over}${unitWord}` : 'Goal reached',
  };
}

/**
 * One tile's display state from the raw numbers.
 * @param key   tile key
 * @param ctx   { health: {steps, distanceKm, activeCalories}, extra: {data}|{needsPermission}|{error}|undefined, goals, loading }
 * @returns { v, unit, pct (0..120 or null), status, hasGoal, sub, badge } or { state: 'loading'|'permission'|'error'|'empty', sub }
 */
export function tileModel(key, { health = {}, extra, goals = {}, loading = false }) {
  switch (key) {
    case 'steps':
      if (loading) return { state: 'loading' };
      return goalTile(health.steps || 0, goals.steps, { valStr: n0(health.steps || 0), unit: '' });
    case 'distance':
      if (loading) return { state: 'loading' };
      return goalTile(health.distanceKm || 0, goals.distanceKm, { unitWord: ' km', valStr: (health.distanceKm || 0).toFixed(1), unit: 'km', dec: 1 });
    case 'energy':
      if (loading) return { state: 'loading' };
      return goalTile(health.activeCalories || 0, goals.burnKcal, { unitWord: ' kcal', valStr: n0(health.activeCalories || 0), unit: 'kcal' });
    default:
      break;
  }
  if (!extra) return { state: 'loading' };
  if (extra.needsPermission) return { state: 'permission', sub: 'Allow WAY to read this from Google Health' };
  if (extra.error) return { state: 'error', sub: 'Couldn’t load from Google Health' };
  const d = extra.data || {};
  switch (key) {
    case 'heart': {
      const bpm = d.restingBpm ?? d.latestBpm;
      if (bpm == null && d.todayMin == null) return { state: 'empty', sub: 'No heart rate recorded' };
      const lohi = d.todayMin != null ? `Low ${d.todayMin} · high ${d.todayMax} today` : 'No readings today yet';
      return {
        v: String(bpm ?? d.todayAvg ?? '—'),
        unit: d.restingBpm != null ? 'bpm resting' : 'bpm',
        pct: bpm ? ((bpm - 40) / 60) * 120 : 0,
        status: 'info',
        hasGoal: false,
        sub: d.irregular?.count ? `${lohi} · ${d.irregular.count} rhythm alert${d.irregular.count > 1 ? 's' : ''}` : lohi,
      };
    }
    case 'oxygen': {
      const spo2 = d.spo2?.percent;
      if (spo2 == null && !d.vo2Max) return { state: 'empty', sub: 'No SpO₂ or VO₂ max yet' };
      return {
        v: spo2 != null ? `${spo2}%` : '—',
        unit: 'SpO₂',
        pct: spo2 != null ? ((spo2 - 90) / 10) * 120 : 0,
        status: spo2 != null && spo2 >= 95 ? 'reached' : spo2 != null ? 'progress' : 'info',
        hasGoal: false,
        sub: d.vo2Max ? `VO₂ max ${d.vo2Max.value}${d.vo2Max.level ? ` · ${String(d.vo2Max.level).toLowerCase().replace(/_/g, ' ')}` : ''}` : 'VO₂ max not available',
        badge: 'Normal',
      };
    }
    case 'floors':
      return goalTile(d.floors || 0, FLOORS_GOAL, { valStr: String(d.floors || 0), unit: 'floors' });
    case 'sleep': {
      const min = d.minutesAsleep;
      if (min == null) return { state: 'empty', sub: 'No sleep recorded last night' };
      const hrs = min / 60;
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      const inRange = hrs >= 7 && hrs <= 9;
      return {
        v: `${h}h ${m}m`,
        unit: '',
        pct: (hrs / 9) * 100,
        status: inRange ? 'reached' : 'progress',
        hasGoal: false,
        sub: inRange ? 'Inside your 7–9 h range' : hrs < 7 ? `${Math.round((7 - hrs) * 60)} min short of 7 h` : 'Longer than 9 h',
        badge: 'In range',
      };
    }
    case 'glucose': {
      if (d.latest == null) return { state: 'empty', sub: 'No readings logged today' };
      const inRange = d.min >= 70 && d.max <= 140;
      return {
        v: String(d.latest),
        unit: 'mg/dL latest',
        pct: ((d.latest - 60) / 120) * 120,
        status: inRange ? 'reached' : 'progress',
        hasGoal: false,
        sub: `${d.count} reading${d.count > 1 ? 's' : ''} · ${d.min}–${d.max} · range 70–140`,
        badge: 'In range',
      };
    }
    default:
      return { state: 'empty', sub: '' };
  }
}
