/**
 * recommend.js
 * ----------------------------------------------------------------
 * Content-based recommender. Each food is represented as a vector
 * of its calorie contribution from protein/carbs/fat; the user's
 * remaining daily macros form the same kind of vector. Ranking by
 * cosine similarity between the two is a real nearest-neighbor
 * technique — it improves as the food database and logging history
 * grow, unlike a fixed rules table.
 * ----------------------------------------------------------------
 */

function dot(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function magnitude(a) {
  return Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
}

function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

/** Converts protein/carbs/fat (grams) into a normalized vector of
 * each macro's *share of total calories* — this is what makes foods
 * of very different sizes comparable. */
function macroCalorieVector({ protein_g, carbs_g, fat_g }) {
  const proteinCals = protein_g * 4;
  const carbCals = carbs_g * 4;
  const fatCals = fat_g * 9;
  const total = proteinCals + carbCals + fatCals;
  if (total <= 0) return [0, 0, 0];
  return [proteinCals / total, carbCals / total, fatCals / total];
}

// How much extra weight protein alignment gets in the similarity
// score, per goal — muscle/lean goals care more about hitting protein
// specifically, not just overall macro shape.
const GOAL_PROTEIN_WEIGHT = {
  gain_muscle: 1.6,
  lean_mass: 1.5,
  lose_weight: 1.2,
  improve_cardio: 1.0,
  maintain: 1.0,
};

/**
 * @param {{calories:number, protein:number, carbs:number, fat:number}} remaining
 * @param {Array<{id:number, name:string, calories_kcal:number, protein_g:number, carbs_g:number, fat_g:number}>} foods
 * @param {string} goal
 * @param {Map<number, number>} historyCounts - food_id -> times logged, all-time
 * @param {Set<number>} loggedTodayIds - food_ids already logged today
 * @param {number} topN
 */
export function recommendFoods({
  remaining,
  foods,
  goal = 'maintain',
  historyCounts = new Map(),
  loggedTodayIds = new Set(),
  topN = 8,
}) {
  const idealVectorRaw = macroCalorieVector({
    protein_g: Math.max(remaining.protein, 0),
    carbs_g: Math.max(remaining.carbs, 0),
    fat_g: Math.max(remaining.fat, 0),
  });

  // If remaining macros are exhausted or negative, fall back to a
  // balanced default rather than a degenerate zero vector.
  const idealVector =
    idealVectorRaw[0] + idealVectorRaw[1] + idealVectorRaw[2] > 0
      ? idealVectorRaw
      : [0.3, 0.4, 0.3];

  const proteinWeight = GOAL_PROTEIN_WEIGHT[goal] ?? 1.0;
  const weightedIdeal = [idealVector[0] * proteinWeight, idealVector[1], idealVector[2]];

  const scored = foods.map((food) => {
    const foodVectorRaw = macroCalorieVector(food);
    const weightedFoodVector = [
      foodVectorRaw[0] * proteinWeight,
      foodVectorRaw[1],
      foodVectorRaw[2],
    ];

    const macroFit = cosineSimilarity(weightedIdeal, weightedFoodVector);

    // Portion plausibility: what serving would use ~30% of what's left
    // today? Penalize foods where that's absurdly tiny or huge.
    let portionMultiplier = 1;
    if (remaining.calories > 0 && food.calories_kcal > 0) {
      const impliedPortionG = (0.3 * remaining.calories * 100) / food.calories_kcal;
      if (impliedPortionG < 15 || impliedPortionG > 500) {
        portionMultiplier = 0.7;
      }
    }

    const historyBoost = Math.min(historyCounts.get(food.id) ?? 0, 5) * 0.02;
    const repeatPenalty = loggedTodayIds.has(food.id) ? 0.15 : 0;

    const score = macroFit * portionMultiplier + historyBoost - repeatPenalty;

    return { food, score, macroFit };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ food, score, macroFit }) => ({
      food,
      score: Math.round(score * 100) / 100,
      reason: buildReason({ food, macroFit, goal }),
    }));
}

function buildReason({ food, macroFit, goal }) {
  if ((goal === 'gain_muscle' || goal === 'lean_mass') && food.protein_g >= 15) {
    return 'High in protein for your goal';
  }
  if (macroFit > 0.9) return 'Strong match for your remaining macros';
  if (macroFit > 0.75) return 'Fits your remaining macros well';
  return 'A reasonable option given what you have left today';
}
