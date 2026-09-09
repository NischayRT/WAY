/**
 * bmrTdee.js
 * ----------------------------------------------------------------
 * Deterministic nutrition math: BMR -> TDEE -> goal-adjusted macro
 * targets. No ML here on purpose — this has to be reliable before
 * any recommendation logic sits on top of it.
 * ----------------------------------------------------------------
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,      // little to no exercise
  light: 1.375,        // light exercise 1-3 days/week
  moderate: 1.55,      // moderate exercise 3-5 days/week
  active: 1.725,       // hard exercise 6-7 days/week
  very_active: 1.9,    // very hard exercise + physical job
};

// Calorie offset and protein-per-kg target by goal.
const GOAL_CONFIG = {
  lose_weight: { calorieOffset: -500, proteinPerKg: 1.8 },
  gain_muscle: { calorieOffset: 300, proteinPerKg: 2.0 },
  lean_mass: { calorieOffset: 150, proteinPerKg: 2.2 },
  improve_cardio: { calorieOffset: 0, proteinPerKg: 1.6 },
  maintain: { calorieOffset: 0, proteinPerKg: 1.6 },
};

/**
 * Mifflin-St Jeor BMR formula.
 * @param {{weightKg:number, heightCm:number, age:number, sex:'male'|'female'}} p
 * @returns {number} BMR in kcal/day
 */
export function calculateBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * TDEE = BMR x activity multiplier.
 * @param {number} bmr
 * @param {keyof ACTIVITY_MULTIPLIERS} activityLevel
 * @returns {number} TDEE in kcal/day
 */
export function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (!multiplier) {
    throw new Error(`Unknown activity level: ${activityLevel}`);
  }
  return bmr * multiplier;
}

/**
 * Goal-adjusted daily targets: calories, protein, and a simple
 * carb/fat split on the remaining calories.
 * @param {number} tdee
 * @param {number} weightKg
 * @param {keyof GOAL_CONFIG} goal
 */
export function calculateMacroTargets(tdee, weightKg, goal) {
  const config = GOAL_CONFIG[goal];
  if (!config) {
    throw new Error(`Unknown goal: ${goal}`);
  }

  const targetCalories = Math.round(tdee + config.calorieOffset);
  const proteinG = Math.round(weightKg * config.proteinPerKg);
  const proteinCalories = proteinG * 4;

  // Remaining calories split 50/50 carbs/fat as a sane default —
  // make this user-adjustable later, don't hardcode forever.
  const remainingCalories = Math.max(targetCalories - proteinCalories, 0);
  const carbsG = Math.round((remainingCalories * 0.5) / 4);
  const fatG = Math.round((remainingCalories * 0.5) / 9);

  return {
    targetCalories,
    proteinG,
    carbsG,
    fatG,
  };
}

/**
 * Convenience: run the full pipeline in one call.
 * @param {{weightKg:number, heightCm:number, age:number, sex:'male'|'female', activityLevel:string, goal:string}} profile
 */
export function getDailyTargets(profile) {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const macros = calculateMacroTargets(tdee, profile.weightKg, profile.goal);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    ...macros,
  };
}

/**
 * Resolves the targets actually used everywhere in the app: the
 * calculated values, with any non-null manual override taking
 * priority per-field. Takes the raw DB profile row (snake_case)
 * so call sites don't need to reshape it first.
 * @param {object} dbProfile - a row from the `profiles` table
 */
export function resolveDailyTargets(dbProfile) {
  const computed = getDailyTargets({
    heightCm: dbProfile.height_cm,
    weightKg: dbProfile.weight_kg,
    age: dbProfile.age,
    sex: dbProfile.sex,
    activityLevel: dbProfile.activity_level,
    goal: dbProfile.goal,
  });

  return {
    bmr: computed.bmr,
    tdee: computed.tdee,
    targetCalories: dbProfile.override_calories ?? computed.targetCalories,
    proteinG: dbProfile.override_protein_g ?? computed.proteinG,
    carbsG: dbProfile.override_carbs_g ?? computed.carbsG,
    fatG: dbProfile.override_fat_g ?? computed.fatG,
  };
}