/**
 * generate-food-inserts.js
 * ----------------------------------------------------------------
 * Turns a CSV of foods into a ready-to-run SQL insert file, so
 * growing the food database is "fill in a spreadsheet" instead of
 * "hand-write SQL rows."
 *
 * Usage:
 *   node scripts/generate-food-inserts.js templates/foods-template.csv > supabase/generated-foods.sql
 *
 * CSV must have a header row with these exact column names (see
 * templates/foods-template.csv for the format):
 *   name,region,category,dish_class,cooking_method,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,source
 *
 * Leave a cell blank for any optional column (region, dish_class,
 * cooking_method, fiber_g) — it becomes NULL in the generated SQL.
 * ----------------------------------------------------------------
 */

const fs = require('fs');

const [, , csvPath] = process.argv;
if (!csvPath) {
  console.error('Usage: node scripts/generate-food-inserts.js path/to/foods.csv');
  process.exit(1);
}

const { readCsv, text, num, run } = require('./csvSql');

run(() => {
  const rows = readCsv(fs.readFileSync(csvPath, 'utf-8')).map(
    (r) =>
      `  (${text(r.name)}, ${text(r.region)}, ${text(r.category)}, ${text(r.dish_class)}, ${text(r.cooking_method)}, ${num(r.calories_kcal, r, 'calories_kcal')}, ${num(r.protein_g, r, 'protein_g')}, ${num(r.carbs_g, r, 'carbs_g')}, ${num(r.fat_g, r, 'fat_g')}, ${num(r.fiber_g, r, 'fiber_g')}, ${text(r.source || 'community_estimated')})`
  );
  return `insert into foods (name, region, category, dish_class, cooking_method, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)\nvalues\n${rows.join(',\n')};\n`;
});
