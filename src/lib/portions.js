/**
 * lib/portions.js
 * Real-world portions (bowl, roti, katori, scoop…) for foods, so people log
 * "2 rotis" instead of "70 g". The foods table stores nutrition per 100 g
 * and a serving_size_g that defaults to 100 for everything, so the portion
 * is inferred from the dish name; a recipe built in the Recipe Builder
 * (source 'user_calculated') uses the serving size it was saved with.
 */

// First match wins, so more specific names come before general ones.
const RULES = [
  [/\b(whey|protein powder|mass gainer)\b/, 'scoop', 33],
  [/\b(paratha|parantha|thepla)\b/, 'paratha', 80],
  [/\b(naan|kulcha)\b/, 'naan', 90],
  [/\b(puri|poori|bhatura)\b/, 'puri', 30],
  [/\b(roti|chapati|chapathi|phulka|bhakri|rotla|tortilla)\b/, 'roti', 35],
  [/\b(idli|idly)\b/, 'idli', 40],
  [/\b(uttapam|uthappam)\b/, 'uttapam', 120],
  [/\b(dosa|dosai|chilla|cheela|pesarattu)\b/, 'dosa', 90],
  [/\b(vada|wada|bonda)\b/, 'vada', 50],
  [/\b(samosa|kachori)\b/, 'samosa', 60],
  [/\b(ladoo|laddu|laddoo|barfi|peda|gulab jamun|rasgulla)\b/, 'piece', 40],
  [/\b(dhokla|khandvi|momo|momos|kebab|tikki|cutlet|pakora|pakoda)\b/, 'piece', 40],
  [/\b(egg|eggs|anda)\b(?!.*\b(curry|bhurji|rice)\b)/, 'egg', 50],
  [/\b(banana|kela)\b/, 'banana', 118],
  [/\b(apple|orange|pear|guava|mango)\b/, 'fruit', 150],
  [/\b(bread|toast|slice|sandwich)\b/, 'slice', 30],
  [/\b(biscuit|cookie|rusk)\b/, 'biscuit', 10],
  [/\b(shake|smoothie|lassi)\b/, 'glass', 250],
  [/\b(chai|tea|coffee|milk|buttermilk|chaas|juice|soup|rasam)\b/, 'cup', 150],
  [/\b(curd|dahi|raita|yogurt|yoghurt|shrikhand)\b/, 'katori', 150],
  [/\b(biryani|pulao|pulav|fried rice|khichdi|khichri)\b/, 'plate', 250],
  [/\b(rice|chawal)\b/, 'cup', 160],
  [/\b(poha|upma|pasta|noodles|maggi|oats|muesli|cornflakes|dalia|sevai|vermicelli)\b/, 'plate', 150],
  [/\b(salad|chaat|sprouts|fruit bowl)\b/, 'bowl', 150],
  [/\b(sabzi|sabji|bhaji|poriyal|thoran|aloo|gobi|bhindi|baingan)\b/, 'bowl', 150],
  [/\b(dal|daal|sambar|rajma|chole|chana|kadhi|curry|paneer|chicken|mutton|fish|keema|korma|masala|makhani|kofta|stew)\b/, 'bowl', 200],
];

const PLURAL = { glass: 'glasses', katori: 'katoris', puri: 'puris', naan: 'naans', vada: 'vadas', idli: 'idlis' };

/** { unit, g } for one portion of a food. */
// Raw ingredients are weighed, except things you naturally count.
const COUNTABLE = new Set(['banana', 'fruit', 'egg', 'slice', 'roti', 'idli', 'biscuit']);

export function portionOf(food) {
  const serving = Number(food?.serving_size_g);
  if (food?.source === 'user_calculated' && serving > 0) return { unit: 'serving', g: Math.round(serving) };
  const ingredient = food?.isIngredient || food?.category === 'ingredient';
  const name = String(food?.name || '').toLowerCase();
  for (const [re, unit, g] of RULES) {
    if (re.test(name)) return !ingredient || COUNTABLE.has(unit) ? { unit, g } : { unit: 'serving', g: 100 };
  }
  return { unit: 'serving', g: 100 };
}

/** "½", "1", "1½", "2". */
export function portionCount(n) {
  if (n % 1 === 0) return String(n);
  if (n === 0.5) return '½';
  return `${Math.floor(n)}½`;
}

/** "2 rotis", "½ bowl", "1½ katoris". */
export function portionLabel(food, n) {
  const { unit } = portionOf(food);
  const plural = n > 1 ? PLURAL[unit] || `${unit}s` : unit;
  return `${portionCount(n)} ${plural}`;
}

/** Nutrition of n portions. */
export function portionNutrition(food, n) {
  const g = portionOf(food).g * n;
  const r = g / 100;
  return {
    g,
    calories: (Number(food.calories_kcal) || 0) * r,
    protein: (Number(food.protein_g) || 0) * r,
    carbs: (Number(food.carbs_g) || 0) * r,
    fat: (Number(food.fat_g) || 0) * r,
  };
}
