import { MEAL_CATEGORIES } from './mealCategories';

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @param {Array<{meal_type:string, quantity_g:number, foods:{name:string, calories_kcal:number, protein_g:number, carbs_g:number, fat_g:number}}>} logs
 * @returns {{ categories: Array<{value:string, label:string, items:Array, totals:object}>, overallTotals: object }}
 */
export function computeMealBreakdown(logs) {
  const byCategory = new Map();

  for (const log of logs) {
    const key = MEAL_CATEGORIES.some((c) => c.value === log.meal_type) ? log.meal_type : 'other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(log);
  }

  const categories = MEAL_CATEGORIES.filter((c) => byCategory.has(c.value)).map((c) => {
    const items = byCategory.get(c.value);
    const rawTotals = items.reduce(
      (acc, log) => {
        const ratio = log.quantity_g / 100;
        return {
          calories: acc.calories + log.foods.calories_kcal * ratio,
          protein: acc.protein + log.foods.protein_g * ratio,
          carbs: acc.carbs + log.foods.carbs_g * ratio,
          fat: acc.fat + log.foods.fat_g * ratio,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      value: c.value,
      label: c.label,
      items,
      totals: {
        calories: round1(rawTotals.calories),
        protein: round1(rawTotals.protein),
        carbs: round1(rawTotals.carbs),
        fat: round1(rawTotals.fat),
      },
    };
  });

  const overallTotals = categories.reduce(
    (acc, cat) => ({
      calories: acc.calories + cat.totals.calories,
      protein: acc.protein + cat.totals.protein,
      carbs: acc.carbs + cat.totals.carbs,
      fat: acc.fat + cat.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return { categories, overallTotals };
}
