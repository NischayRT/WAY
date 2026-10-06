/**
 * bmrTdee.js
 * ----------------------------------------------------------------
 * Deterministic nutrition math: BMR -> TDEE -> goal-adjusted macro
 * targets. No ML here on purpose — this has to be reliable before
 * any recommendation logic sits on top of it.
 * ----------------------------------------------------------------
 */

// Physical-activity multipliers on BMR (standard PAL values).
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,      // little to no exercise
  light: 1.375,        // light exercise 1-3 days/week
  moderate: 1.55,      // moderate exercise 3-5 days/week
  active: 1.725,       // hard exercise 6-7 days/week
  very_active: 1.9,    // very hard exercise + physical job
};

/**
 * Lowest daily intake the app will ever suggest without medical
 * supervision: the widely used 1,200 kcal (women) / 1,500 kcal (men).
 * The old flat "-500 kcal" could take a small, sedentary woman to ~900.
 */
export const CALORIE_FLOOR = { male: 1500, female: 1200 };

/**
 * Goal settings.
 *  - Weight loss: a 20% deficit off TDEE, kept between 300 and 750 kcal.
 *    A percentage scales with body size; a flat 500 kcal is a far bigger
 *    cut for a 50 kg woman than for a 90 kg man.
 *  - Muscle gain: smaller surpluses for women, who add lean mass at
 *    roughly half the absolute rate of men, so extra calories mostly
 *    become fat.
 *  - Protein (g per kg of reference weight, see referenceWeightKg):
 *    1.6–2.2 g/kg covers the evidence range for people who train,
 *    with the higher end during a deficit to protect lean mass. The same
 *    per-kg targets apply to women and men.
 */
const GOAL_CONFIG = {
  lose_weight: { deficitPct: 0.2, minDeficit: 300, maxDeficit: 750, proteinPerKg: 1.8 },
  gain_muscle: { surplus: { male: 300, female: 200 }, proteinPerKg: 2.0 },
  lean_mass: { surplus: { male: 150, female: 100 }, proteinPerKg: 2.0 },
  improve_cardio: { surplus: { male: 0, female: 0 }, proteinPerKg: 1.6 },
  maintain: { surplus: { male: 0, female: 0 }, proteinPerKg: 1.6 },
};

// Fat: 30% of calories by default, never below 20% (the bottom of the
// 20–35% acceptable range). Going lower is a particular problem for women,
// where very-low-fat, low-energy diets are linked to menstrual disruption.
const FAT_SHARE_DEFAULT = 0.3;
const FAT_SHARE_MIN = 0.2;
// 130 g/day carbohydrate is the RDA (the brain's glucose needs). If a plan
// would go below it, fat is reduced (down to the 20% floor) to make room.
const CARB_MIN_G = 130;

const normSex = (sex) => (sex === 'female' ? 'female' : sex === 'male' ? 'male' : null);

/**
 * Mifflin-St Jeor BMR formula.
 * @param {{weightKg:number, heightCm:number, age:number, sex:'male'|'female'}} p
 * @returns {number} BMR in kcal/day
 */
export function calculateBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const s = normSex(sex);
  // Unknown sex: halfway between the male (+5) and female (-161) constants.
  return base + (s === 'male' ? 5 : s === 'female' ? -161 : -78);
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
 * Body weight to base protein on. Above BMI 25, protein per kg of total
 * weight overshoots (fat tissue needs little protein), so the weight at
 * BMI 25 for the person's height is used instead.
 */
export function referenceWeightKg(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm) / 100;
  if (!(h > 0)) return w;
  return Math.min(w, 25 * h * h);
}

/** Daily protein target in grams for a goal. */
export function proteinTargetG({ weightKg, heightCm, goal = 'maintain' }) {
  const perKg = (GOAL_CONFIG[goal] || GOAL_CONFIG.maintain).proteinPerKg;
  return Math.round(referenceWeightKg(weightKg, heightCm) * perKg);
}

/**
 * Split a calorie target into carbs and fat once protein is fixed.
 * Exported so screens that set their own calorie target (Body Studio's
 * "set goal") produce macros that actually add up to it.
 */
export function splitCarbsFat(targetCalories, proteinG) {
  const kcal = Math.max(Number(targetCalories) || 0, 0);
  const proteinKcal = proteinG * 4;
  let fatKcal = kcal * FAT_SHARE_DEFAULT;
  let carbKcal = kcal - proteinKcal - fatKcal;
  if (carbKcal < CARB_MIN_G * 4) {
    const room = fatKcal - kcal * FAT_SHARE_MIN;
    const shift = Math.min(room, CARB_MIN_G * 4 - carbKcal);
    fatKcal -= shift;
    carbKcal += shift;
  }
  return {
    carbsG: Math.max(Math.round(carbKcal / 4), 0),
    fatG: Math.round(fatKcal / 9),
  };
}

/**
 * Goal-adjusted daily targets.
 * @param {number} tdee
 * @param {number} weightKg
 * @param {keyof GOAL_CONFIG} goal
 * @param {{sex?: 'male'|'female', heightCm?: number}} [opts]
 */
export function calculateMacroTargets(tdee, weightKg, goal, { sex, heightCm } = {}) {
  const config = GOAL_CONFIG[goal];
  if (!config) {
    throw new Error(`Unknown goal: ${goal}`);
  }
  const s = normSex(sex) || 'female'; // unknown: use the more conservative values

  let target;
  if (config.deficitPct) {
    const deficit = Math.min(config.maxDeficit, Math.max(config.minDeficit, tdee * config.deficitPct));
    target = tdee - deficit;
  } else {
    target = tdee + config.surplus[s];
  }
  // Never below the safe floor, and never above TDEE when losing weight.
  target = Math.max(target, CALORIE_FLOOR[s]);
  if (config.deficitPct) target = Math.min(target, tdee);
  const targetCalories = Math.round(target);

  const proteinG = proteinTargetG({ weightKg, heightCm, goal });
  const { carbsG, fatG } = splitCarbsFat(targetCalories, proteinG);

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
  const macros = calculateMacroTargets(tdee, profile.weightKg, profile.goal, {
    sex: profile.sex,
    heightCm: profile.heightCm,
  });

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

  return { bmr: computed.bmr, tdee: computed.tdee, ...applyOverrides(computed, dbProfile) };
}

/**
 * Overrides win field by field, but carbs and fat that were NOT overridden
 * are re-split from the effective calorie and protein targets. Previously
 * an overridden calorie target (e.g. from Body Studio) kept carbs and fat
 * computed for the old target, so the macros added up to a different
 * number of calories than the target shown.
 */
export function applyOverrides(computed, dbProfile) {
  const targetCalories = dbProfile.override_calories ?? computed.targetCalories;
  const proteinG = dbProfile.override_protein_g ?? computed.proteinG;
  const resplit =
    targetCalories !== computed.targetCalories || proteinG !== computed.proteinG
      ? splitCarbsFat(targetCalories, proteinG)
      : { carbsG: computed.carbsG, fatG: computed.fatG };
  return {
    targetCalories,
    proteinG,
    carbsG: dbProfile.override_carbs_g ?? resplit.carbsG,
    fatG: dbProfile.override_fat_g ?? resplit.fatG,
  };
}