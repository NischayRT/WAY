import { getDailyTargets } from './bmrTdee';

/**
 * Finds the weight log closest in calendar distance to targetDateStr.
 * If tied, picks the more recent or prior date.
 * Falls back to profileWeight if no logs exist.
 */
export function findNearestWeight(targetDateStr, weightLogs = [], fallbackWeight = 70) {
  if (!weightLogs || weightLogs.length === 0) {
    return fallbackWeight;
  }

  const targetTime = new Date(`${targetDateStr}T00:00:00Z`).getTime();
  let closestWeight = fallbackWeight;
  let minDiff = Infinity;

  for (const entry of weightLogs) {
    const entryTime = new Date(`${entry.logged_at}T00:00:00Z`).getTime();
    const diff = Math.abs(entryTime - targetTime);

    if (diff < minDiff) {
      minDiff = diff;
      closestWeight = Number(entry.weight_kg);
    }
  }

  return closestWeight;
}

/**
 * Recalculates daily targets for a specific date given the nearest logged weight.
 */
export function resolveDateTargets({ profile, targetDateStr, weightLogs = [] }) {
  const effectiveWeight = findNearestWeight(
    targetDateStr,
    weightLogs,
    Number(profile.weight_kg) || 70
  );

  const computed = getDailyTargets({
    heightCm: Number(profile.height_cm),
    weightKg: effectiveWeight,
    age: Number(profile.age),
    sex: profile.sex,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });

  return {
    effectiveWeight,
    bmr: computed.bmr,
    tdee: computed.tdee,
    targetCalories: profile.override_calories ?? computed.targetCalories,
    proteinG: profile.override_protein_g ?? computed.proteinG,
    carbsG: profile.override_carbs_g ?? computed.carbsG,
    fatG: profile.override_fat_g ?? computed.fatG,
  };
}