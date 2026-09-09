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
    return `  (${escape(row.name)}, ${escape(row.category)}, ${numOrNull(row.calories_kcal)}, ${numOrNull(row.protein_g)}, ${numOrNull(row.carbs_g)}, ${numOrNull(row.fat_g)}, ${numOrNull(row.fiber_g)}, ${escape(row.source || 'community_estimated')})`;
  });

const sql = `insert into ingredients (name, category, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)\nvalues\n${rows.join(',\n')};\n`;

console.log(sql);