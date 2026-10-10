/**
 * lib/goalState.js
 * One set of rules for "how am I doing against this target", shared by the
 * home cards (activity tiles, calories, nutritional orbit, meal targets,
 * weight bar) so they all react the same way.
 */

/** Activity tiles celebrate again once you pass your goal by this much. */
export const ACTIVITY_BUFFER_PCT = 20;
/** Calories eaten count as "on target" within this many kcal either side. */
export const CALORIE_BUFFER_KCAL = 50;
/** Macros and meals: "on target" within this share of the target... */
export const INTAKE_BUFFER_PCT = 10;
/** ...but never a band narrower than this (grams or kcal), so small targets aren't twitchy. */
export const INTAKE_BUFFER_MIN = 5;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * More is better (steps, distance, active calories, protein).
 * progress -> reached (>= goal) -> exceeded (>= goal + buffer)
 */
export function activityStatus(value, goal, bufferPct = ACTIVITY_BUFFER_PCT) {
  const g = num(goal);
  const v = num(value);
  if (!(g > 0) || v < g) return 'progress';
  return v >= g * (1 + bufferPct / 100) ? 'exceeded' : 'reached';
}

/**
 * Aim for the target (calories, carbs, fat, a meal's budget).
 * progress -> onTarget (within +/- buffer) -> over (more than buffer above)
 */
export function intakeStatus(value, target, buffer) {
  const t = num(target);
  const v = num(value);
  if (!(t > 0)) return 'progress';
  const band = buffer ?? Math.max(INTAKE_BUFFER_MIN, (t * INTAKE_BUFFER_PCT) / 100);
  if (v < t - band) return 'progress';
  return v - t > band ? 'over' : 'onTarget';
}

/** 0..100, capped. */
export function pctOf(value, target) {
  const t = num(target);
  return t > 0 ? Math.max(0, Math.min(100, (num(value) / t) * 100)) : 0;
}

/**
 * Share of the way from the first weight ever logged to the goal weight
 * (works for losing and gaining). Same rule as the body preview's
 * "x% closer to goal", so the two always agree.
 * @param weightLogs newest first, as the home page loads them
 */
export function weightProgress({ weightLogs = [], currentKg, targetKg }) {
  const target = num(targetKg);
  const now = num(currentKg);
  if (!(target > 0) || !(now > 0)) return null;
  const oldest = weightLogs.length ? num(weightLogs[weightLogs.length - 1].weight_kg) : now;
  const start = oldest > 0 ? oldest : now;
  const total = start - target;
  let p;
  if (Math.abs(total) < 0.05) p = Math.abs(now - target) < 0.5 ? 1 : 0;
  else p = (start - now) / total;
  return Math.min(1, Math.max(0, p));
}
