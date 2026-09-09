/**
 * recipeNutrition.js
 * ----------------------------------------------------------------
 * Given a list of raw ingredient quantities and the dish's final
 * (post-cooking) weight, compute nutrition per 100g of the finished
 * dish. Water loss (frying, roasting) or gain (boiling dal, rice)
 * is captured automatically by the ratio of raw weight to final
 * weight — no separate cooking-method adjustment needed.
 * ----------------------------------------------------------------
 */

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @param {Array<{ ingredient: {calories_kcal:number, protein_g:number, carbs_g:number, fat_g:number, fiber_g?:number}, quantityG: number }>} lines
 * @param {number} finalWeightG - weight of the dish after cooking, in grams
 * @returns {{ rawWeightG:number, finalWeightG:number, per100g: {calories_kcal:number, protein_g:number, carbs_g:number, fat_g:number, fiber_g:number} }}
 */
export function computeDishNutrition(lines, finalWeightG) {
  if (!lines || lines.length === 0) {
    throw new Error('Add at least one ingredient before calculating nutrition.');
  }
  if (!finalWeightG || finalWeightG <= 0) {
    throw new Error('Final weight must be greater than 0.');
  }

  const totals = lines.reduce(
    (acc, line) => {
      const ratio = line.quantityG / 100; // ingredient values are per 100g
      return {
        calories: acc.calories + line.ingredient.calories_kcal * ratio,
        protein: acc.protein + line.ingredient.protein_g * ratio,
        carbs: acc.carbs + line.ingredient.carbs_g * ratio,
        fat: acc.fat + line.ingredient.fat_g * ratio,
        fiber: acc.fiber + (line.ingredient.fiber_g || 0) * ratio,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const rawWeightG = lines.reduce((sum, line) => sum + Number(line.quantityG), 0);
  const scale = 100 / finalWeightG;

  return {
    rawWeightG: round1(rawWeightG),
    finalWeightG,
    per100g: {
      calories_kcal: round1(totals.calories * scale),
      protein_g: round1(totals.protein * scale),
      carbs_g: round1(totals.carbs * scale),
      fat_g: round1(totals.fat * scale),
      fiber_g: round1(totals.fiber * scale),
    },
  };
}
