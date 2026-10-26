/**
 * generate-ingredient-inserts.js
 * ----------------------------------------------------------------
 * Same idea as generate-food-inserts.js, for the ingredients table.
 *
 * Usage:
 *   node scripts/generate-ingredient-inserts.js templates/ingredients-template.csv > supabase/generated-ingredients.sql
 *
 * CSV header required:
 *   name,category,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,source
 * ----------------------------------------------------------------
 */

const fs = require('fs');

const [, , csvPath] = process.argv;
if (!csvPath) {
  console.error('Usage: node scripts/generate-ingredient-inserts.js path/to/ingredients.csv');
  process.exit(1);
}

const { readCsv, text, num, run } = require('./csvSql');

run(() => {
  const rows = readCsv(fs.readFileSync(csvPath, 'utf-8')).map(
    (r) =>
      `  (${text(r.name)}, ${text(r.category)}, ${num(r.calories_kcal, r, 'calories_kcal')}, ${num(r.protein_g, r, 'protein_g')}, ${num(r.carbs_g, r, 'carbs_g')}, ${num(r.fat_g, r, 'fat_g')}, ${num(r.fiber_g, r, 'fiber_g')}, ${text(r.source || 'community_estimated')})`
  );
  return `insert into ingredients (name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)\nvalues\n${rows.join(',\n')};\n`;
});
