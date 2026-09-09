/**
 * weekStatus.js
 * ----------------------------------------------------------------
 * Two pieces: grouping a range of food_logs into per-date totals,
 * and turning a day's totals-vs-targets into the color rules for
 * the week strip (fill = protein status, border = calorie status).
 * ----------------------------------------------------------------
 */

export function computeDailyTotalsByDate(logs) {
  const byDate = new Map();

  for (const log of logs) {
    const ratio = log.quantity_g / 100;
    const existing = byDate.get(log.logged_at) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    byDate.set(log.logged_at, {
      calories: existing.calories + log.foods.calories_kcal * ratio,
      protein: existing.protein + log.foods.protein_g * ratio,
      carbs: existing.carbs + log.foods.carbs_g * ratio,
      fat: existing.fat + log.foods.fat_g * ratio,
    });
  }

  return byDate;
}

/**
 * @param {{hasLogs:boolean, consumed:{calories:number, protein:number}, targets:{targetCalories:number, proteinG:number}}} params
 * @returns {{bgClass:string, borderClass:string}}
 */
export function getDayVisualStatus({ hasLogs, consumed, targets }) {
  if (!hasLogs) {
    return { bgClass: 'bg-surface', borderClass: 'border-stone' };
  }

  const proteinDiff = consumed.protein - targets.proteinG;
  let bgClass;
  if (proteinDiff < 0) {
    bgClass = 'bg-brick/25'; // under protein target
  } else if (proteinDiff <= 100) {
    bgClass = 'bg-cardamom/25'; // at target, within 100g buffer over
  } else {
    bgClass = 'bg-brinjal/25'; // more than 100g over
  }

  const calorieDiff = consumed.calories - targets.targetCalories;
  const borderClass = calorieDiff > 0 ? 'border-brick' : 'border-turmeric';

  return { bgClass, borderClass };
}
