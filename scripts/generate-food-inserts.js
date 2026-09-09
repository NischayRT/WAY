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

const raw = fs.readFileSync(csvPath, 'utf-8').trim();
const [headerLine, ...lines] = raw.split('\n');
const headers = headerLine.split(',').map((h) => h.trim());

function escape(val) {
  if (val === '' || val === undefined) return 'null';
  return `'${val.replace(/'/g, "''")}'`;
}

function numOrNull(val) {
  if (val === '' || val === undefined) return 'null';
  return val;
}

const rows = lines
  .filter((l) => l.trim().length > 0)
  .map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    return `  (${escape(row.name)}, ${escape(row.region)}, ${escape(row.category)}, ${escape(row.dish_class)}, ${escape(row.cooking_method)}, ${numOrNull(row.calories_kcal)}, ${numOrNull(row.protein_g)}, ${numOrNull(row.carbs_g)}, ${numOrNull(row.fat_g)}, ${numOrNull(row.fiber_g)}, ${escape(row.source || 'community_estimated')})`;
  });

const sql = `insert into foods (name, region, category, dish_class, cooking_method, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)\nvalues\n${rows.join(',\n')};\n`;

console.log(sql);