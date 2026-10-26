/**
 * generate-recipe-inserts.js
 * ----------------------------------------------------------------
 * Links dishes to their ingredients for the closest-match autofill
 * feature. Dishes are referenced by name (since foods.id isn't
 * known until after the foods CSV is uploaded); ingredients are
 * referenced by id (already fixed, since ingredients are uploaded
 * first) — this is what keeps the CSV small.
 *
 * Usage:
 *   node scripts/generate-recipe-inserts.js recipes-data.csv > supabase/generated-recipes.sql
 *
 * CSV header required (one row per ingredient in a dish):
 *   dish_name,ingredient_id,quantity_g
 *
 * Example:
 *   dish_name,ingredient_id,quantity_g
 *   Chole,45,150
 *   Chole,12,30
 *   Pav Bhaji,45,100
 *
 * Run this AFTER your foods CSV has been uploaded — dish_name must
 * match a foods.name exactly (case-sensitive), or that row's food_id
 * lookup returns nothing and the row is silently skipped by the join.
 * ----------------------------------------------------------------
 */

const fs = require('fs');

const [, , csvPath] = process.argv;
if (!csvPath) {
  console.error('Usage: node scripts/generate-recipe-inserts.js path/to/recipes.csv');
  process.exit(1);
}

const { readCsv, text, num, int, run } = require('./csvSql');

run(() => {
  const rows = readCsv(fs.readFileSync(csvPath, 'utf-8')).map(
    (r) => `  (${text(r.dish_name)}, ${int(r.ingredient_id, r, 'ingredient_id')}, ${num(r.quantity_g, r, 'quantity_g')})`
  );
  return `insert into dish_ingredients (food_id, ingredient_id, quantity_g)
select f.id, v.ingredient_id, v.quantity_g
from (values
${rows.join(',\n')}
) as v(dish_name, ingredient_id, quantity_g)
join foods f on f.name = v.dish_name and f.created_by is null;
`;
});
