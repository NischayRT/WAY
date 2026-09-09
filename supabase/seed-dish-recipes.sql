-- ============================================================
-- Recipe lines for a few of the seeded dishes, so "closest match"
-- has real ingredient lists to autofill from. These quantities are
-- approximate and don't need to reconcile exactly with the
-- already-seeded per-100g values on `foods` — they're a starting
-- template for users to edit, not a recomputation of that dish.
-- ============================================================

insert into dish_ingredients (food_id, ingredient_id, quantity_g)
select f.id, i.id, v.quantity_g
from (values
  ('Dal Tadka', 'Toor dal (raw)', 100),
  ('Dal Tadka', 'Water', 300),
  ('Dal Tadka', 'Onion (raw)', 30),
  ('Dal Tadka', 'Tomato (raw)', 30),
  ('Dal Tadka', 'Garlic', 5),
  ('Dal Tadka', 'Ginger', 5),
  ('Dal Tadka', 'Refined oil', 10),

  ('Roti (whole wheat)', 'Wheat flour (atta)', 100),
  ('Roti (whole wheat)', 'Water', 60),

  ('Chana Masala', 'Chana dal (raw)', 150),
  ('Chana Masala', 'Onion (raw)', 50),
  ('Chana Masala', 'Tomato (raw)', 50),
  ('Chana Masala', 'Refined oil', 15),
  ('Chana Masala', 'Garlic', 5),
  ('Chana Masala', 'Ginger', 5),

  ('Paneer Butter Masala', 'Paneer', 150),
  ('Paneer Butter Masala', 'Tomato (raw)', 100),
  ('Paneer Butter Masala', 'Butter', 20),
  ('Paneer Butter Masala', 'Onion (raw)', 30),
  ('Paneer Butter Masala', 'Milk (whole)', 50),

  ('Sambar', 'Toor dal (raw)', 80),
  ('Sambar', 'Water', 300),
  ('Sambar', 'Tomato (raw)', 30),
  ('Sambar', 'Carrot', 30),
  ('Sambar', 'Brinjal (eggplant)', 30),
  ('Sambar', 'Refined oil', 10)
) as v(food_name, ingredient_name, quantity_g)
join foods f on f.name = v.food_name and f.created_by is null
join ingredients i on i.name = v.ingredient_name;
