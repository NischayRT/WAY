/**
 * lib/goalFeasibility.js
 * Validates timeline and caloric requirements against clinical safety thresholds.
 */

export function calculateTimelineAndFeasibility({
  currentWeightKg,
  targetWeightKg,
  targetDateStr,
  currentBmr,
  tdee,
  sex = 'male',
  targetBfPct,
}) {
  const today = new Date();
  const targetDate = new Date(targetDateStr);
  const diffTime = targetDate - today;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const weightDelta = targetWeightKg - currentWeightKg;
  const absDelta = Math.abs(weightDelta);

  // Suggested safe pace updated to 0.85 kg/week for cutting
  const safePacePerWeek = weightDelta < 0 ? 0.85 : 0.40;
  const recommendedWeeks = Math.max(1, Math.round(absDelta / safePacePerWeek));
  const recommendedDate = new Date();
  recommendedDate.setDate(recommendedDate.getDate() + recommendedWeeks * 7);
  const recommendedDateStr = recommendedDate.toISOString().split('T')[0];

  if (days <= 0) {
    return {
      isFeasible: false,
      days: 0,
      weeks: 0,
      weeklyRate: 0,
      recommendedDateStr,
      recommendedWeeks,
      reasons: ['Target date must be set in the future.'],
    };
  }

  const weeks = days / 7;
  const weeklyRate = absDelta / weeks;
  const pctBodyweightPerWeek = (weeklyRate / currentWeightKg) * 100;

  // 7,700 kcal per kg of human body mass shift
  const totalCalorieDelta = weightDelta * 7700;
  const dailyCalorieAdjustment = Math.round(totalCalorieDelta / days);
  const calculatedDailyCalories = Math.round(tdee + dailyCalorieAdjustment);

  // Clinical safety thresholds
  const minCalorieFloor = sex === 'male' ? 1450 : 1200;
  // In lib/goalFeasibility.js -> calculateTimelineAndFeasibility
const minEssentialBf = sex === 'male' ? 5.0 : 12.0;

  const failureReasons = [];

  if (weightDelta < 0) {
    // Upper safe boundary: ~1.15 kg/week or > 1.25% bodyweight/week
    if (pctBodyweightPerWeek > 1.25 || weeklyRate > 1.15) {
      failureReasons.push(
        `Rate of loss (${weeklyRate.toFixed(2)} kg/week, ${pctBodyweightPerWeek.toFixed(1)}%/week) exceeds clinical limits (safe maximum is ~0.85–1.0 kg/week).`
      );
    }
    if (calculatedDailyCalories < minCalorieFloor) {
      failureReasons.push(
        `Requires consuming only ${calculatedDailyCalories} kcal/day, which falls below your safe metabolic floor (${minCalorieFloor} kcal).`
      );
    }
    if (targetBfPct != null && targetBfPct < minEssentialBf) {
      failureReasons.push(
        `Projected body fat (${targetBfPct}%) is dangerously close to essential fat minimums (${minEssentialBf}%).`
      );
    }
  } else if (weightDelta > 0) {
    if (weeklyRate > 0.6) {
      failureReasons.push(
        `A surplus rate of ${weeklyRate.toFixed(2)} kg/week exceeds natural muscular hypertrophy limits and will be mostly stored as fat.`
      );
    }
  }

  return {
    isFeasible: failureReasons.length === 0,
    days,
    weeks: Math.round(weeks * 10) / 10,
    weeklyRate: Math.round(weeklyRate * 100) / 100,
    calculatedDailyCalories,
    recommendedWeeks,
    recommendedDateStr,
    reasons: failureReasons,
  };
}