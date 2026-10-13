/**
 * lib/planner.js
 *
 * Builds a person's plan from their details, goal weight and chosen pace:
 * daily calories, macros, weekly pace, a realistic target date, and the
 * reasons behind each number, so onboarding can explain them.
 *
 * Calories
 *   TDEE = Mifflin-St Jeor BMR x activity multiplier (lib/bmrTdee).
 *   The change comes from the PACE, as a share of body weight per week
 *   (a 50 kg and a 100 kg person shouldn't get the same fixed deficit),
 *   converted at ~7,700 kcal per kg, then made safe:
 *     losing:  deficit <= 25% of TDEE, never below 1,200 (women) / 1,500 (men) kcal
 *     gaining: surplus <= 15% of TDEE (extra beyond that mostly becomes fat)
 *   If a cap applies, the pace and date are recalculated from what's safe.
 *
 * Macros (same rules as the rest of the app, lib/bmrTdee)
 *   Protein: 1.2-1.6 g per kg of reference weight by goal, +0.2 for people
 *            who train most days, max 2.0 g/kg and 35% of calories.
 *   Fat:     28% of calories (20% minimum).
 *   Carbs:   the rest, at least 130 g where possible.
 */

import {
  calculateBMR,
  calculateTDEE,
  CALORIE_FLOOR,
  proteinTargetG,
  proteinPerKgFor,
  referenceWeightKg,
  splitCarbsFat,
} from './bmrTdee';

const KCAL_PER_KG = 7700;

/** Weekly pace as % of body weight, by direction. */
export const PACES = {
  lose: [
    { key: 'gentle', label: 'Gentle', pct: 0.25, note: 'Easiest to stick with' },
    { key: 'standard', label: 'Steady', pct: 0.5, note: 'Recommended for most people' },
    { key: 'fast', label: 'Faster', pct: 0.75, note: 'Harder; best with strength training' },
  ],
  gain: [
    { key: 'gentle', label: 'Lean', pct: 0.15, note: 'Least fat gain' },
    { key: 'standard', label: 'Steady', pct: 0.25, note: 'Recommended for most people' },
    { key: 'fast', label: 'Faster', pct: 0.4, note: 'More fat gained alongside muscle' },
  ],
};

// Absolute weekly caps, whatever the percentage says.
const MAX_LOSS_KG_WEEK = 1.0;
const MAX_GAIN_KG_WEEK = { male: 0.35, female: 0.25 };

/** Healthy weight range for a height. Asian BMI cut-offs (normal 18.5-22.9), used in India. */
export function healthyWeightRange(heightCm) {
  const h = Number(heightCm) / 100;
  if (!(h > 0)) return null;
  return { min: Math.round(18.5 * h * h), max: Math.round(22.9 * h * h * 10) / 10 };
}

/** BMI and its category on the Asian cut-offs used in India. */
export function bmiInfo(weightKg, heightCm) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!(h > 0) || !(w > 0)) return null;
  const bmi = w / (h * h);
  let label = 'Healthy';
  if (bmi < 18.5) label = 'Underweight';
  else if (bmi >= 25) label = 'Obese range';
  else if (bmi >= 23) label = 'Overweight';
  return { bmi: Math.round(bmi * 10) / 10, label };
}

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * @param p {
 *   sex, age, heightCm, weightKg, activityLevel,
 *   goal: 'lose_weight' | 'maintain' | 'gain_muscle' | 'lean_mass' | 'improve_cardio',
 *   targetWeightKg?, paceKey?: 'gentle' | 'standard' | 'fast', today?: Date
 * }
 */
export function buildPlan(p) {
  const sex = p.sex === 'female' ? 'female' : 'male';
  const weight = Number(p.weightKg);
  const height = Number(p.heightCm);
  const today = p.today ? new Date(p.today) : new Date();
  const warnings = [];
  const notes = [];

  const bmr = calculateBMR({ weightKg: weight, heightCm: height, age: Number(p.age), sex });
  const tdee = calculateTDEE(bmr, p.activityLevel || 'light');

  // Direction comes from the goal weight when there is one.
  const target = Number(p.targetWeightKg) || null;
  let direction = 'maintain';
  if (target && target < weight - 0.25) direction = 'lose';
  else if (target && target > weight + 0.25) direction = 'gain';
  else if (!target && p.goal === 'lose_weight') direction = 'lose';
  else if (!target && p.goal === 'gain_muscle') direction = 'gain';

  // The goal stored on the profile follows the direction (e.g. "lose" + a
  // higher target weight would make no sense).
  let goal = p.goal || 'maintain';
  if (direction === 'lose') goal = 'lose_weight';
  if (direction === 'gain' && goal !== 'lean_mass') goal = 'gain_muscle';
  if (direction === 'maintain' && (goal === 'lose_weight' || goal === 'gain_muscle')) goal = 'maintain';

  let calories = tdee;
  let paceKgWeek = 0;
  let weeks = null;
  let targetDate = null;
  const pace = direction === 'maintain' ? null : PACES[direction].find((x) => x.key === (p.paceKey || 'standard')) || PACES[direction][1];

  if (direction === 'lose') {
    paceKgWeek = Math.min((weight * pace.pct) / 100, MAX_LOSS_KG_WEEK);
    let deficit = (paceKgWeek * KCAL_PER_KG) / 7;
    const maxDeficit = tdee * 0.25;
    if (deficit > maxDeficit) {
      deficit = maxDeficit;
      warnings.push('Capped at a 25% calorie deficit; deeper cuts tend to cost muscle and are hard to sustain.');
    }
    calories = tdee - deficit;
    if (calories < CALORIE_FLOOR[sex]) {
      calories = Math.min(tdee, CALORIE_FLOOR[sex]);
      warnings.push(`Raised to ${CALORIE_FLOOR[sex].toLocaleString('en-IN')} kcal, the lowest we suggest without medical supervision. Moving more will speed things up safely.`);
    }
  } else if (direction === 'gain') {
    paceKgWeek = Math.min((weight * pace.pct) / 100, MAX_GAIN_KG_WEEK[sex]);
    let surplus = (paceKgWeek * KCAL_PER_KG) / 7;
    const maxSurplus = tdee * 0.15;
    if (surplus > maxSurplus) {
      surplus = maxSurplus;
      warnings.push('Capped at a 15% surplus; beyond that most extra weight is fat, not muscle.');
    }
    calories = tdee + surplus;
  } else if (goal === 'lean_mass') {
    // Recomposition at the same weight: maintenance, protein does the work.
    notes.push('Body recomposition: eat at maintenance with higher protein and strength training.');
  }

  // Target and maintenance are both shown to the nearest 10 kcal. Rounding
  // only the target made "maintain" read as e.g. 2,400 vs 2,401 (−1 kcal).
  calories = Math.round(calories / 10) * 10;
  const maintenance = Math.round(tdee / 10) * 10;
  const delta = calories - maintenance;
  if (direction !== 'maintain') {
    paceKgWeek = Math.abs((delta * 7) / KCAL_PER_KG); // actual pace after caps
    const kg = Math.abs(target ? target - weight : 0);
    if (kg > 0 && paceKgWeek > 0) {
      weeks = Math.ceil(kg / paceKgWeek);
      targetDate = iso(addDays(today, weeks * 7));
    }
  }

  const protein = proteinTargetG({ weightKg: weight, heightCm: height, goal, activityLevel: p.activityLevel, calories });
  const { carbsG, fatG } = splitCarbsFat(calories, protein);
  const kcalOf = { protein: protein * 4, carbs: carbsG * 4, fat: fatG * 9 };
  const sum = kcalOf.protein + kcalOf.carbs + kcalOf.fat || 1;

  // Sanity notes about the goal weight itself.
  const range = healthyWeightRange(height);
  if (target && range) {
    if (target < range.min) warnings.push(`Your goal is below the healthy range for your height (${range.min}-${range.max} kg).`);
    if (direction === 'lose' && target > range.max) notes.push(`A first goal is a great start; the healthy range for your height is ${range.min}-${range.max} kg.`);
  }
  if (weeks && weeks > 52) notes.push('This is a long journey; consider a nearer first milestone. You can change your goal any time in Body Studio.');

  const refKg = referenceWeightKg(weight, height);
  return {
    sex,
    bmr: Math.round(bmr),
    tdee: maintenance,
    direction,
    goal,
    pace: pace?.key ?? null,
    paceKgWeek: Math.round(paceKgWeek * 100) / 100,
    weeks,
    targetDate,
    calories,
    deltaKcal: delta,
    proteinG: protein,
    carbsG,
    fatG,
    split: {
      protein: Math.round((kcalOf.protein / sum) * 100),
      carbs: Math.round((kcalOf.carbs / sum) * 100),
      fat: Math.round((kcalOf.fat / sum) * 100),
    },
    proteinPerKg: Math.round((protein / refKg) * 10) / 10,
    proteinPerKgRule: proteinPerKgFor(goal, p.activityLevel),
    referenceWeightKg: Math.round(refKg * 10) / 10,
    fibreG: Math.round((calories / 1000) * 14),
    waterL: Math.round(weight * 0.035 * 10) / 10,
    warnings,
    notes,
  };
}
